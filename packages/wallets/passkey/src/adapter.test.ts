import { createHash } from 'node:crypto'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import { generateKey, verifyCompressed } from 'falcon-1024'
import {
  ScopeType,
  decodeEmptySignature,
  encodeEmptySignature,
  getSignatureType,
  type AdapterStoreAccessor,
  type Siwa
} from '@txnlab/use-wallet/adapter'
import { WalletManager } from '@txnlab/use-wallet'
import { createTestHarness, type State, type Store } from '@txnlab/use-wallet/testing'
import type { MockInstance } from 'vitest'
import { PasskeyAdapter, type PasskeyConfirmation, type PasskeyOptions } from './adapter'
import { passkey } from './index'
import { prfInput } from './derivation'
import { WorkerKeyStore, type PasskeyKeyStore } from './key-store'
import { LOCAL_STORAGE_PASSKEY_KEY, loadRecord } from './record'

// Stand in for the worker key store with the same derivation, run in Node
vi.mock('./key-store', async () => {
  const { generateKey, signCompressed } = await import('falcon-1024')
  const { keygenSeedFromEntropy } = await import('./derivation')

  class WorkerKeyStore {
    static instances: WorkerKeyStore[] = []
    private privateKey: Uint8Array | null = null

    constructor(
      public options: {
        idleTimeoutMs?: number
        maxAgeMs?: number
        onLock?: (reason: string) => void
      } = {}
    ) {
      WorkerKeyStore.instances.push(this)
    }

    get unlocked() {
      return this.privateKey !== null
    }

    async unlock(entropy: Uint8Array) {
      const keygenSeed = keygenSeedFromEntropy(entropy)
      entropy.fill(0)
      const keys = generateKey(keygenSeed)
      this.privateKey = keys.privateKey
      return keys.publicKey
    }

    async sign(bytes: Uint8Array) {
      if (!this.privateKey) throw new Error('locked')
      return signCompressed(this.privateKey, bytes)
    }

    lock() {
      this.privateKey = null
    }

    /** Lock the way the worker's timeouts do */
    expire(reason: 'idle' | 'max-age') {
      this.privateKey = null
      this.options.onLock?.(reason)
    }
  }

  return { WorkerKeyStore }
})

const FakeKeyStore = WorkerKeyStore as unknown as {
  instances: (PasskeyKeyStore & {
    options: { idleTimeoutMs?: number; maxAgeMs?: number }
    expire: (reason: 'idle' | 'max-age') => void
  })[]
}

const WALLET_ID = 'passkey'
// The RP ID is the hostname; ARC-60 domains are the host, port included
const DOMAIN = 'dapp.example'
const HOST = 'dapp.example:8443'
// hayai-client's PRF_VECTOR, returned as the passkey's PRF output
const PRF_VECTOR = '0123456789abcdef1032547698badcfedeadbeefcafebabefeedface00112233'
const ADDRESS = 'EIPP4HVON56N55A54OTPEXDTGXYKEMPH5UVTNKJZZNLQ6DAZW5DO2YN54A'
const CREDENTIAL_ID = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
const NEW_CREDENTIAL_ID = new Uint8Array([9, 9, 9, 9])

const unhex = (value: string) => new Uint8Array(Buffer.from(value, 'hex'))

// ---------- Fake authenticator ------------------------------------- //

class FakePublicKeyCredential {
  constructor(
    public rawId: ArrayBuffer,
    private extensions: AuthenticationExtensionsClientOutputs
  ) {}

  getClientExtensionResults() {
    return this.extensions
  }
}

interface Authenticator {
  supportsPrf: boolean
  /** The PRF output for an `eval.first` input */
  prfOutput: (input: Uint8Array) => Uint8Array
  failWith?: Error
  /** Answer with this credential ID instead of the requested one */
  rawId?: Uint8Array
  /** Resolve `get` and `create` with null */
  returnNull?: boolean
  /** Throw from `get` synchronously, before returning a promise */
  syncThrow?: Error
}

const sha256 = (bytes: Uint8Array) => new Uint8Array(createHash('sha256').update(bytes).digest())
const bytesEqual = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, i) => byte === b[i])

// The PRF_VECTOR account for the default context; any other input gets its own output
const defaultPrfOutput = (input: Uint8Array) =>
  bytesEqual(input, prfInput('')) ? unhex(PRF_VECTOR) : sha256(input)

let authenticator: Authenticator
let getCalls: CredentialRequestOptions[]
let createCalls: CredentialCreationOptions[]

const toBuffer = (bytes: Uint8Array) => new Uint8Array(bytes).buffer

const credentials = {
  create: vi.fn(async (options: CredentialCreationOptions) => {
    createCalls.push(options)
    if (authenticator.failWith) throw authenticator.failWith
    if (authenticator.returnNull) return null
    return new FakePublicKeyCredential(toBuffer(NEW_CREDENTIAL_ID), {})
  }),
  get: vi.fn((options: CredentialRequestOptions) => {
    if (authenticator.syncThrow) throw authenticator.syncThrow
    return fakeGet(options)
  })
}

async function fakeGet(options: CredentialRequestOptions) {
  getCalls.push(options)
  if (authenticator.failWith) throw authenticator.failWith
  if (authenticator.returnNull) return null
  const publicKey = options.publicKey!
  const allowed = publicKey.allowCredentials?.[0]?.id as Uint8Array | undefined
  const rawId = authenticator.rawId ?? (allowed ? new Uint8Array(allowed) : CREDENTIAL_ID)
  const prf = publicKey.extensions?.prf
  const input = prf?.eval?.first as Uint8Array | undefined
  const extensions: AuthenticationExtensionsClientOutputs =
    prf && input && authenticator.supportsPrf
      ? { prf: { results: { first: toBuffer(authenticator.prfOutput(new Uint8Array(input))) } } }
      : {}
  return new FakePublicKeyCredential(toBuffer(rawId), extensions)
}

const prfCalls = () => getCalls.filter((call) => call.publicKey?.extensions?.prf)
const bareCalls = () => getCalls.filter((call) => !call.publicKey?.extensions?.prf)

// ---------- localStorage ------------------------------------------- //

let localStorageData: Record<string, string> = {}

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageData[key]
  }),
  clear: vi.fn(() => {
    localStorageData = {}
  })
}

// ---------- Helpers ------------------------------------------------- //

/** The auth address algod reports for every account, if rekeyed */
let algodAuthAddr: string | undefined
/** Auth addresses algod reports for particular accounts, over `algodAuthAddr` */
let algodAuthAddrs: Record<string, string | undefined>
/** Fails every algod read */
let algodError: Error | undefined
/** Holds every algod read until it settles */
let algodGate: Promise<void> | undefined

const accountInformation = vi.fn((address: string) => {
  const request = {
    exclude: () => request,
    do: async () => {
      await algodGate
      if (algodError) throw algodError
      const authAddr = address in algodAuthAddrs ? algodAuthAddrs[address] : algodAuthAddr
      return authAddr ? { authAddr: algosdk.Address.fromString(authAddr) } : {}
    }
  }
  return request
})

/** Subscribes to the test's store, as the manager does */
let subscribeToStore: (callback: (state: State) => void) => () => void

function createWallet(accessor: AdapterStoreAccessor, options?: PasskeyOptions): PasskeyAdapter {
  return new PasskeyAdapter({
    id: WALLET_ID,
    metadata: PasskeyAdapter.defaultMetadata,
    store: accessor,
    subscribe: (callback) => subscribeToStore(callback),
    getAlgodClient: () => ({ accountInformation }) as unknown as algosdk.Algodv2,
    options
  })
}

function makePayment(sender: string, note?: string, rekeyTo?: string): algosdk.Transaction {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: sender,
    amount: 0,
    rekeyTo,
    note: note ? new TextEncoder().encode(note) : undefined,
    suggestedParams: {
      flatFee: true,
      fee: 3000,
      minFee: 1000,
      firstValid: 1,
      lastValid: 1000,
      genesisID: 'testnet-v1.0',
      genesisHash: algosdk.base64ToBytes('SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=')
    }
  })
}

const OTHER_ADDRESS = algosdk.generateAccount().addr.toString()
// ed25519 accounts that can be rekeyed to the passkey account
const LEGACY_ACCOUNT = algosdk.generateAccount()
const LEGACY = LEGACY_ACCOUNT.addr.toString()
const LEGACY_2 = algosdk.generateAccount().addr.toString()
// Rekeyed accounts are recorded by the network's genesis hash
const TESTNET = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
const MAINNET = 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
const onTestnet = (...addresses: string[]) =>
  addresses.map((address) => ({ address, network: TESTNET }))

/** The same address with other padding bits in its last character, which algosdk accepts */
function nonCanonical(address: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const last = alphabet.indexOf(address[57])
  return address.slice(0, 57) + alphabet[(last & ~3) | ((last + 1) & 3)]
}

function expectValidSignature(signed: Uint8Array, txn: algosdk.Transaction) {
  const decoded = algosdk.decodeSignedTransaction(signed)
  expect(decoded.pqsig).toBeDefined()
  expect(algosdk.addressFromPQSig(decoded.pqsig!).toString()).toBe(ADDRESS)
  expect(verifyCompressed(decoded.pqsig!.pk, decoded.pqsig!.sig, txn.bytesToSign())).toBe(true)
  expect(decoded.txn.txID()).toBe(txn.txID())
}

/** The signer a signed transaction names, if any */
const sgnrOf = (signed: Uint8Array) => algosdk.decodeSignedTransaction(signed).sgnr?.toString()

const storedRecord = () => JSON.parse(localStorageData[LOCAL_STORAGE_PASSKEY_KEY])

function siwaData(overrides: Partial<Siwa> = {}): string {
  const siwa: Siwa = {
    domain: HOST,
    chain_id: 'algorand:testnet',
    account_address: ADDRESS,
    type: 'falcon-1024-det',
    uri: `https://${HOST}`,
    version: '1',
    'issued-at': '2026-10-20T00:00:00.000Z',
    ...overrides
  }
  return btoa(canonify(siwa)!)
}

// ---------- Tests --------------------------------------------------- //

describe('PasskeyAdapter', () => {
  let store: Store<State>
  let accessor: AdapterStoreAccessor

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageData = {}
    authenticator = { supportsPrf: true, prfOutput: defaultPrfOutput }
    algodAuthAddr = undefined
    algodAuthAddrs = {}
    algodError = undefined
    algodGate = undefined
    getCalls = []
    createCalls = []
    FakeKeyStore.instances.length = 0

    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('navigator', { credentials })
    vi.stubGlobal('PublicKeyCredential', FakePublicKeyCredential)
    vi.stubGlobal('location', { hostname: DOMAIN, host: HOST })

    const harness = createTestHarness(WALLET_ID)
    store = harness.store
    accessor = harness.accessor
    subscribeToStore = (callback) => {
      const subscription = harness.store.subscribe(() => callback(harness.store.state))
      return () => subscription.unsubscribe()
    }
  })

  afterEach(() => {
    // PRF output depends on user verification, so no PRF ceremony may loosen it
    for (const call of prfCalls()) {
      expect(call.publicKey?.userVerification).toBe('required')
    }
    vi.unstubAllGlobals()
  })

  describe('factory options', () => {
    it('rejects a context containing ":"', () => {
      expect(() => createWallet(accessor, { context: 'a:b' })).toThrow('must not contain ":"')
    })
  })

  describe('connect', () => {
    it('signs in with the passkey picker and derives the Falcon account', async () => {
      const wallet = createWallet(accessor)
      const accounts = await wallet.connect()

      expect(accounts).toHaveLength(1)
      expect(accounts[0].address).toBe(ADDRESS)
      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WALLET_ID]?.activeAccount?.address).toBe(ADDRESS)

      expect(getCalls).toHaveLength(1)
      const request = getCalls[0].publicKey!
      expect(request.rpId).toBe(DOMAIN)
      expect(request.allowCredentials).toBeUndefined()
      expect(new Uint8Array(request.extensions!.prf!.eval!.first as Uint8Array)).toEqual(
        prfInput('')
      )
    })

    it("sets a pqsig empty signature from the account's public key", async () => {
      const wallet = createWallet(accessor)
      const [account] = await wallet.connect()

      expect(getSignatureType(account.emptySignature)).toBe('pqsig')
      const { pqsig } = decodeEmptySignature(account.emptySignature!)
      expect(pqsig!.sch).toEqual(algosdk.FALCON_1024_SCHEME)
      expect(pqsig!.slt).toBe(0)
      expect(pqsig!.pk).toHaveLength(1793)
      expect(algosdk.addressFromPQSig(pqsig!).toString()).toBe(ADDRESS)
    })

    it('persists only public data', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      const stored = localStorageData[LOCAL_STORAGE_PASSKEY_KEY]
      const record = JSON.parse(stored)
      expect(Object.keys(record).sort()).toEqual(
        ['address', 'context', 'credentialId', 'publicKey', 'rpId', 'salt', 'version'].sort()
      )
      expect(record).toMatchObject({ version: 1, rpId: DOMAIN, context: '', address: ADDRESS })

      const entropy = unhex(PRF_VECTOR)
      for (const value of Object.values(localStorageData)) {
        expect(value).not.toContain(PRF_VECTOR)
        expect(value).not.toContain(Buffer.from(entropy).toString('base64'))
        expect(value).not.toContain(algosdk.mnemonicFromSeed(entropy).split(' ')[0] + ' ')
      }
    })

    it('creates a passkey, then evaluates the PRF scoped to it', async () => {
      const wallet = createWallet(accessor, { rpName: 'Example dApp' })
      await wallet.connect({ create: true, userName: 'alice' })

      expect(createCalls).toHaveLength(1)
      const creation = createCalls[0].publicKey!
      expect(creation.rp).toEqual({ id: DOMAIN, name: 'Example dApp' })
      expect(creation.user.name).toBe('alice')
      expect(creation.authenticatorSelection).toMatchObject({
        residentKey: 'required',
        userVerification: 'required'
      })
      expect(creation.extensions).toEqual({ prf: {} })

      expect(prfCalls()).toHaveLength(1)
      const scoped = prfCalls()[0].publicKey!.allowCredentials!
      expect(scoped).toHaveLength(1)
      expect(new Uint8Array(scoped[0].id as Uint8Array)).toEqual(NEW_CREDENTIAL_ID)

      const record = JSON.parse(localStorageData[LOCAL_STORAGE_PASSKEY_KEY])
      expect(record.credentialId).toBe(Buffer.from(NEW_CREDENTIAL_ID).toString('base64'))
    })

    it('uses a custom rpId and context', async () => {
      const wallet = createWallet(accessor, { rpId: 'example.com', context: 'my-app' })
      await wallet.connect()

      const request = getCalls[0].publicKey!
      expect(request.rpId).toBe('example.com')
      expect(new Uint8Array(request.extensions!.prf!.eval!.first as Uint8Array)).toEqual(
        prfInput('my-app')
      )
    })

    it('fails without storing anything when the provider lacks PRF', async () => {
      authenticator.supportsPrf = false
      const wallet = createWallet(accessor)

      await expect(wallet.connect()).rejects.toMatchObject({ code: 'prf-unsupported' })
      expect(wallet.isConnected).toBe(false)
      expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeUndefined()
    })

    it('classifies a cancelled prompt', async () => {
      authenticator.failWith = new DOMException('The operation was aborted', 'NotAllowedError')
      const wallet = createWallet(accessor)

      await expect(wallet.connect()).rejects.toMatchObject({
        name: 'PasskeyError',
        code: 'cancelled'
      })
    })

    it('locks the key after connecting without a session', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      expect(FakeKeyStore.instances).toHaveLength(1)
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)
    })

    it('keeps the key unlocked after connecting with a session', async () => {
      const wallet = createWallet(accessor, { session: { idleTimeoutMs: 60_000 } })
      await wallet.connect()

      expect(FakeKeyStore.instances[0].unlocked).toBe(true)
      expect(FakeKeyStore.instances[0].options.idleTimeoutMs).toBe(60_000)
    })
  })

  describe('resumeSession', () => {
    it('restores the account without a ceremony', async () => {
      await createWallet(accessor).connect()
      getCalls = []

      const resumed = createWallet(accessor)
      await resumed.resumeSession()

      expect(resumed.isConnected).toBe(true)
      expect(getCalls).toHaveLength(0)
    })

    it('disconnects when the passkey record is missing', async () => {
      await createWallet(accessor).connect()
      delete localStorageData[LOCAL_STORAGE_PASSKEY_KEY]

      const resumed = createWallet(accessor)
      await resumed.resumeSession()

      expect(resumed.isConnected).toBe(false)
    })

    it('disconnects when the RP ID no longer matches the record', async () => {
      await createWallet(accessor).connect()

      const resumed = createWallet(accessor, { rpId: 'other.example' })
      await resumed.resumeSession()

      expect(resumed.isConnected).toBe(false)
      expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeUndefined()
    })
  })

  describe('signTransactions', () => {
    it('runs one PRF ceremony scoped to the connected passkey, then locks', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      getCalls = []

      const txns = [makePayment(ADDRESS, 'a'), makePayment(ADDRESS, 'b')]
      algosdk.assignGroupID(txns)
      const signed = await wallet.signTransactions(txns)

      expect(signed).toHaveLength(2)
      signed.forEach((stxn, index) => expectValidSignature(stxn!, txns[index]))

      expect(prfCalls()).toHaveLength(1)
      const scoped = prfCalls()[0].publicKey!.allowCredentials!
      expect(new Uint8Array(scoped[0].id as Uint8Array)).toEqual(CREDENTIAL_ID)
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)

      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(prfCalls()).toHaveLength(2)
    })

    it('signs only its own unsigned transactions at the requested indexes', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      const txns = [
        makePayment(ADDRESS, 'a'),
        makePayment(OTHER_ADDRESS),
        makePayment(ADDRESS, 'c')
      ]
      const signed = await wallet.signTransactions(txns, [1, 2])

      expect(signed).toHaveLength(1)
      expectValidSignature(signed[0]!, txns[2])
    })

    it('accepts encoded transactions', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      const txn = makePayment(ADDRESS)
      const [signed] = await wallet.signTransactions([algosdk.encodeUnsignedTransaction(txn)])

      expectValidSignature(signed!, txn)
    })

    it('signs nothing, without a prompt, for an empty indexesToSign', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      getCalls = []
      const txns = [makePayment(ADDRESS, 'a'), makePayment(ADDRESS, 'b')]

      expect(await wallet.signTransactions(txns, [])).toEqual([])
      const encoded = txns.map((txn) => algosdk.encodeUnsignedTransaction(txn))
      expect(await wallet.signTransactions(encoded, [])).toEqual([])
      expect(getCalls).toHaveLength(0)
    })

    it('skips the ceremony when there is nothing to sign', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      getCalls = []

      expect(await wallet.signTransactions([makePayment(OTHER_ADDRESS)])).toEqual([])
      expect(getCalls).toHaveLength(0)
    })

    it('fails closed when the passkey derives a different key', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      authenticator.prfOutput = () => new Uint8Array(32).fill(7)

      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'key-mismatch'
      })
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)
    })

    it('throws when not connected', async () => {
      const wallet = createWallet(accessor)
      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'not-connected'
      })
    })

    describe('with a session', () => {
      it('confirms with a presence prompt by default, without evaluating the PRF', async () => {
        const wallet = createWallet(accessor, { session: true })
        await wallet.connect()
        getCalls = []

        const txn = makePayment(ADDRESS)
        const [signed] = await wallet.signTransactions([txn])

        expectValidSignature(signed!, txn)
        expect(prfCalls()).toHaveLength(0)
        expect(bareCalls()).toHaveLength(1)
        const request = bareCalls()[0].publicKey!
        expect(request.userVerification).toBe('preferred')
        expect(new Uint8Array(request.allowCredentials![0].id as Uint8Array)).toEqual(CREDENTIAL_ID)
        expect(FakeKeyStore.instances[0].unlocked).toBe(true)
      })

      it('follows the confirm policy', async () => {
        const confirm = vi.fn().mockReturnValueOnce('silent').mockReturnValueOnce('verify')
        const wallet = createWallet(accessor, { session: true, confirm })
        await wallet.connect()
        getCalls = []

        const txn = makePayment(ADDRESS)
        await wallet.signTransactions([txn])
        expect(getCalls).toHaveLength(0)
        expect(confirm).toHaveBeenLastCalledWith({ type: 'transactions', transactions: [txn] })

        await wallet.signTransactions([makePayment(ADDRESS)])
        expect(bareCalls()).toHaveLength(1)
        expect(bareCalls()[0].publicKey!.userVerification).toBe('required')
      })

      it('unlocks with a PRF ceremony after a page reload', async () => {
        await createWallet(accessor, { session: true }).connect()

        const reloaded = createWallet(accessor, { session: true })
        await reloaded.resumeSession()
        getCalls = []

        await reloaded.signTransactions([makePayment(ADDRESS)])
        expect(prfCalls()).toHaveLength(1)
        expect(bareCalls()).toHaveLength(0)
      })
    })

    it('uses a custom key store as a session', async () => {
      const keyStore = new (WorkerKeyStore as unknown as new () => PasskeyKeyStore)()
      const lock = vi.spyOn(keyStore, 'lock')
      const wallet = createWallet(accessor, { keyStore: () => keyStore, confirm: () => 'silent' })
      await wallet.connect()
      lock.mockClear()

      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(lock).not.toHaveBeenCalled()
      expect(keyStore.unlocked).toBe(true)

      await wallet.disconnect()
      expect(lock).toHaveBeenCalled()
    })
  })

  describe('signData', () => {
    const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }

    it('signs a SIWA request with the Falcon key', async () => {
      const wallet = createWallet(accessor)
      const [account] = await wallet.connect()
      const data = siwaData()

      const response = await wallet.signData(data, metadata)

      const { pqsig } = decodeEmptySignature(account.emptySignature!)
      expect(response.scheme).toBe('falcon-1024-det')
      expect(response.signer).toEqual(pqsig!.pk)
      const json = new TextEncoder().encode(atob(data))
      const dataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', json))
      const authHash = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new Uint8Array(response.authenticatorData))
      )
      const message = new Uint8Array([...dataHash, ...authHash])
      expect(verifyCompressed(response.signer, response.signature, message)).toBe(true)
      expect(prfCalls()).toHaveLength(2)
    })

    it.each([
      [
        'an unsupported encoding',
        () => siwaData(),
        { scope: ScopeType.AUTH, encoding: 'hex' },
        4602
      ],
      [
        'a non-auth scope',
        () => siwaData(),
        { scope: ScopeType.UNKNOWN, encoding: 'base64' },
        4600
      ],
      ['non-JSON data', () => btoa('not json'), metadata, 4609],
      [
        'non-canonical JSON',
        () => btoa(JSON.stringify({ version: '1', domain: DOMAIN })),
        metadata,
        4609
      ],
      ['another domain', () => siwaData({ domain: 'evil.example' }), metadata, 4610],
      ['an ed25519 request', () => siwaData({ type: 'ed25519' }), metadata, 4603],
      ['another account', () => siwaData({ account_address: OTHER_ADDRESS }), metadata, 4603]
    ])('rejects %s before prompting', async (_name, data, requestMetadata, code) => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      getCalls = []

      await expect(wallet.signData(data(), requestMetadata)).rejects.toMatchObject({ code })
      expect(getCalls).toHaveLength(0)
    })
  })

  describe('exportRecoveryPhrase', () => {
    it('returns the phrase after a scoped PRF ceremony', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      getCalls = []

      const { scheme, phrase } = await wallet.exportRecoveryPhrase()

      expect(scheme).toBe('falcon-1024')
      expect(phrase).toBe(algosdk.mnemonicFromSeed(unhex(PRF_VECTOR)))
      expect(prfCalls()).toHaveLength(1)
      expect(
        new Uint8Array(prfCalls()[0].publicKey!.allowCredentials![0].id as Uint8Array)
      ).toEqual(CREDENTIAL_ID)
    })

    it('restores the same account through the Falcon 25-word import', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      const { phrase } = await wallet.exportRecoveryPhrase()
      const keygenSeed = algosdk.pq25WordMnemonicToSeed(phrase, algosdk.FALCON_1024_SCHEME)
      const { publicKey } = generateKey(keygenSeed)
      const { address } = algosdk.addressFromPQKey(algosdk.FALCON_1024_SCHEME, publicKey)
      expect(address.toString()).toBe(ADDRESS)

      // The same words as a regular account restore a different, empty account
      expect(algosdk.mnemonicToSecretKey(phrase).addr.toString()).not.toBe(ADDRESS)
    })

    it('refuses when the passkey derives a different key', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      authenticator.prfOutput = () => new Uint8Array(32).fill(7)

      await expect(wallet.exportRecoveryPhrase()).rejects.toMatchObject({ code: 'key-mismatch' })
    })
  })

  describe('disconnect', () => {
    it('removes the record and locks the key', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()

      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeUndefined()
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)
    })
  })

  describe('derivation through the adapter', () => {
    // ARC-76 vector with salt 1, taken as the PRF output
    const SALT_1_ENTROPY = 'e1078b9af5d2b58abc819135f6b8f358a3a36dd04d4707eb51f481d766a86915'
    const SALT_1_ADDRESS = 'TD5NFW5MEPGAT4S2AIN6XK5DIPJQMCOVN3272HJUJPPG3TB52MNFESSRXA'

    it('carries the address salt into the empty signature and pqsig', async () => {
      authenticator.prfOutput = () => unhex(SALT_1_ENTROPY)
      const wallet = createWallet(accessor)
      const [account] = await wallet.connect()

      expect(account.address).toBe(SALT_1_ADDRESS)
      const { pqsig } = decodeEmptySignature(account.emptySignature!)
      expect(pqsig!.slt).toBe(1)
      expect(algosdk.addressFromPQSig(pqsig!).toString()).toBe(SALT_1_ADDRESS)
      expect(JSON.parse(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).salt).toBe(1)

      const txn = makePayment(SALT_1_ADDRESS)
      const [signed] = await wallet.signTransactions([txn])
      const decoded = algosdk.decodeSignedTransaction(signed!)
      expect(decoded.pqsig!.slt).toBe(1)
      expect(algosdk.addressFromPQSig(decoded.pqsig!).toString()).toBe(SALT_1_ADDRESS)
    })

    it('evaluates the PRF with the account context on every ceremony', async () => {
      const wallet = createWallet(accessor, { context: 'my-app' })
      const [account] = await wallet.connect()
      expect(account.address).not.toBe(ADDRESS)

      await wallet.signTransactions([makePayment(account.address)])
      const { phrase } = await wallet.exportRecoveryPhrase()

      expect(prfCalls()).toHaveLength(3)
      for (const call of prfCalls()) {
        expect(new Uint8Array(call.publicKey!.extensions!.prf!.eval!.first as Uint8Array)).toEqual(
          prfInput('my-app')
        )
      }
      expect(phrase).toBe(algosdk.mnemonicFromSeed(sha256(prfInput('my-app'))))
    })
  })

  describe('key store lifecycle', () => {
    it('uses a 15-minute idle timeout and a 1-hour maximum age for a session, and neither without one', async () => {
      await createWallet(accessor, { session: true }).connect()
      await createWallet(accessor).connect()
      await createWallet(accessor, { session: false }).connect()

      expect(FakeKeyStore.instances.map((store) => store.options.idleTimeoutMs)).toEqual([
        15 * 60 * 1000,
        0,
        0
      ])
      expect(FakeKeyStore.instances.map((store) => store.options.maxAgeMs)).toEqual([
        60 * 60 * 1000,
        0,
        0
      ])
      expect(FakeKeyStore.instances.map((store) => store.unlocked)).toEqual([true, false, false])
    })

    it('locks a session on a key mismatch, and unlocks with a PRF ceremony after', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      FakeKeyStore.instances[0].lock() // the idle timeout fired
      authenticator.prfOutput = () => new Uint8Array(32).fill(7)

      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'key-mismatch'
      })
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)

      authenticator.prfOutput = defaultPrfOutput
      getCalls = []
      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(prfCalls()).toHaveLength(1)
      expect(bareCalls()).toHaveLength(0)
    })

    it('locks the key after signData without a session', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      await wallet.signData(siwaData(), { scope: ScopeType.AUTH, encoding: 'base64' })
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)
    })

    it("checks an export in a throwaway key store, leaving the session's alone", async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()

      await wallet.exportRecoveryPhrase()

      expect(FakeKeyStore.instances).toHaveLength(2)
      expect(FakeKeyStore.instances[0].unlocked).toBe(true)
      expect(FakeKeyStore.instances[1].unlocked).toBe(false)
    })

    it('locks the session when a reconnect fails', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      authenticator.failWith = new DOMException('cancelled', 'NotAllowedError')

      await expect(wallet.connect()).rejects.toMatchObject({ code: 'cancelled' })
      expect(FakeKeyStore.instances[0].unlocked).toBe(false)
    })

    it('creates a new key store after a disconnect', async () => {
      const keyStore = vi.fn(() => new (WorkerKeyStore as unknown as new () => PasskeyKeyStore)())
      const wallet = createWallet(accessor, { keyStore })

      await wallet.connect()
      await wallet.disconnect()
      await wallet.connect()

      expect(keyStore).toHaveBeenCalledTimes(2)
    })

    it('fails closed on an unknown confirm value', async () => {
      const wallet = createWallet(accessor, {
        session: true,
        confirm: () => 'sure' as unknown as PasskeyConfirmation
      })
      await wallet.connect()
      getCalls = []

      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(bareCalls()[0].publicKey!.userVerification).toBe('required')
    })
  })

  describe('connected record', () => {
    async function connectThen(edit: (record: Record<string, unknown>) => void) {
      await createWallet(accessor).connect()
      const record = JSON.parse(localStorageData[LOCAL_STORAGE_PASSKEY_KEY])
      edit(record)
      localStorageData[LOCAL_STORAGE_PASSKEY_KEY] = JSON.stringify(record)
    }

    it('does nothing when there is no session to resume', async () => {
      const wallet = createWallet(accessor)
      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled()
    })

    it.each([
      ['version 2', (r: Record<string, unknown>) => (r.version = 2)],
      ['a missing salt', (r: Record<string, unknown>) => delete r.salt],
      ['a numeric rpId', (r: Record<string, unknown>) => (r.rpId = 1)],
      ['a numeric context', (r: Record<string, unknown>) => (r.context = 1)],
      ['a missing credential ID', (r: Record<string, unknown>) => delete r.credentialId],
      ['a numeric public key', (r: Record<string, unknown>) => (r.publicKey = 1)],
      ['a missing address', (r: Record<string, unknown>) => delete r.address],
      ['another address', (r: Record<string, unknown>) => (r.address = OTHER_ADDRESS)],
      ['another context', (r: Record<string, unknown>) => (r.context = 'other')]
    ])('disconnects on resume when the record has %s', async (_name, edit) => {
      await connectThen(edit)

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(false)
    })

    it('disconnects on resume when the record is not JSON', async () => {
      await createWallet(accessor).connect()
      localStorageData[LOCAL_STORAGE_PASSKEY_KEY] = '{not json'

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(false)
    })

    it('drops a store account the record does not list on resume, without disconnecting', async () => {
      await createWallet(accessor).connect()
      const [account] = store.state.wallets[WALLET_ID]!.accounts
      accessor.setAccounts([account, { name: 'Other', address: OTHER_ADDRESS }])
      accessor.setActiveAccount(OTHER_ADDRESS)

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(true)
      expect(wallet.addresses).toEqual([ADDRESS])
      expect(wallet.activeAddress).toBe(ADDRESS)
      expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeDefined()
    })

    it('disconnects on resume when the store lacks the passkey account', async () => {
      await createWallet(accessor).connect()
      accessor.setAccounts([{ name: 'Other', address: OTHER_ADDRESS }])

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(false)
    })

    it('ignores malformed rekeyed entries and keeps the record', async () => {
      algodAuthAddrs[LEGACY] = ADDRESS
      await connectThen((record) => {
        record.rekeyedAccounts = [
          1,
          null,
          { address: LEGACY },
          { address: 'not an address', network: TESTNET },
          { address: ADDRESS, network: TESTNET },
          { address: nonCanonical(LEGACY), network: TESTNET },
          { address: LEGACY, network: TESTNET },
          { address: LEGACY_2, network: MAINNET }
        ]
      })

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(true)
      expect(wallet.addresses).toEqual([ADDRESS, LEGACY])
    })

    it.each([
      ['no network', { address: LEGACY }],
      ['a numeric network', { address: LEGACY, network: 5 }]
    ])('drops a rekeyed entry with %s, keeping the record', async (_name, entry) => {
      await connectThen((record) => (record.rekeyedAccounts = [entry]))

      const record = loadRecord()
      expect(record?.address).toBe(ADDRESS)
      expect(record?.rekeyedAccounts).toEqual([])
    })

    it('ignores a rekeyed list that is not an array', async () => {
      await connectThen((record) => (record.rekeyedAccounts = LEGACY))

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(true)
      expect(wallet.addresses).toEqual([ADDRESS])
    })

    it('refuses to sign with a record from another RP ID', async () => {
      await createWallet(accessor).connect()

      const wallet = createWallet(accessor, { rpId: 'other.example' })
      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'not-connected'
      })
    })

    it('fails closed when the stored public key is truncated', async () => {
      await connectThen((record) => {
        const publicKey = Buffer.from(record.publicKey as string, 'base64')
        record.publicKey = publicKey.subarray(0, 1000).toString('base64')
      })

      const wallet = createWallet(accessor)
      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'key-mismatch'
      })
    })
  })

  describe('encoded transactions', () => {
    it('skips signed transactions, other senders and unrequested indexes', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      // An ed25519 signature: core's isSignedTxn recognizes only `sig`
      const signedOwn = algosdk.encodeMsgpack(
        new algosdk.SignedTransaction({
          txn: makePayment(ADDRESS, 'signed'),
          sig: new Uint8Array(64).fill(1)
        })
      )
      const own = makePayment(ADDRESS, 'own')
      const group = [
        signedOwn,
        algosdk.encodeUnsignedTransaction(makePayment(OTHER_ADDRESS)),
        algosdk.encodeUnsignedTransaction(own)
      ]

      const signed = await wallet.signTransactions(group)
      expect(signed).toHaveLength(1)
      expectValidSignature(signed[0]!, own)

      expect(await wallet.signTransactions(group, [0, 1])).toEqual([])
    })
  })

  describe('signData edge cases', () => {
    const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }

    it.each([
      ['JSON null', () => btoa('null'), metadata, 4609],
      ['a JSON string', () => btoa('"x"'), metadata, 4609],
      ['the hostname instead of the host', () => siwaData({ domain: DOMAIN }), metadata, 4610],
      [
        'a bad encoding and scope (encoding first)',
        () => siwaData(),
        { scope: ScopeType.UNKNOWN, encoding: 'hex' },
        4602
      ],
      [
        'a bad domain and scheme (domain first)',
        () => siwaData({ domain: 'evil.example', type: 'ed25519' }),
        metadata,
        4610
      ]
    ])('rejects %s', async (_name, data, requestMetadata, code) => {
      const wallet = createWallet(accessor)
      await wallet.connect()

      await expect(wallet.signData(data(), requestMetadata)).rejects.toMatchObject({ code })
    })

    it('rejects a signer other than the connected key after the prompt', async () => {
      const wallet = createWallet(accessor)
      const [account] = await wallet.connect()

      // Another Falcon key, which algod reports as the account's auth address
      const { publicKey } = generateKey(sha256(new TextEncoder().encode('other key')))
      const { address, salt } = algosdk.addressFromPQKey(algosdk.FALCON_1024_SCHEME, publicKey)
      algodAuthAddr = address.toString()
      accessor.setAccounts([
        {
          ...account,
          emptySignature: encodeEmptySignature({
            pqsig: {
              sch: algosdk.FALCON_1024_SCHEME,
              slt: salt,
              pk: publicKey,
              sig: new Uint8Array()
            }
          })
        }
      ])

      await expect(wallet.signData(siwaData(), metadata)).rejects.toMatchObject({ code: 4603 })
      expect(prfCalls()).toHaveLength(2)
    })
  })

  describe('passkey creation', () => {
    it('defaults the RP name and user name, and lets connect override the user name', async () => {
      await createWallet(accessor).connect({ create: true })
      await createWallet(accessor, { userName: 'from options' }).connect({ create: true })
      await createWallet(accessor, { userName: 'from options' }).connect({
        create: true,
        userName: 'from connect'
      })

      expect(createCalls[0].publicKey!.rp.name).toBe(DOMAIN)
      expect(createCalls.map((call) => call.publicKey!.user.name)).toEqual([
        `${DOMAIN} account`,
        'from options',
        'from connect'
      ])
    })

    it('makes a discoverable credential with a fresh user handle each time', async () => {
      await createWallet(accessor).connect({ create: true })
      await createWallet(accessor).connect({ create: true })

      const [first, second] = createCalls.map((call) => call.publicKey!)
      expect(first.authenticatorSelection?.requireResidentKey).toBe(true)
      expect(first.pubKeyCredParams.map((param) => param.alg)).toEqual([-8, -7, -257])
      expect(first.user.id).toHaveLength(16)
      expect(Buffer.from(first.user.id as Uint8Array)).not.toEqual(
        Buffer.from(second.user.id as Uint8Array)
      )
    })
  })

  describe('WebAuthn failures', () => {
    it('rejects an answer from a different passkey', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      authenticator.rawId = new Uint8Array([7, 7, 7])

      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'key-mismatch'
      })
    })

    it('rejects a PRF output that is not 32 bytes', async () => {
      authenticator.prfOutput = () => new Uint8Array(16)
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({
        code: 'prf-unsupported'
      })
    })

    it('reports a browser without WebAuthn', async () => {
      vi.stubGlobal('PublicKeyCredential', undefined)
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({ code: 'unsupported' })
    })

    it('treats a null credential as cancelled', async () => {
      authenticator.returnNull = true
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({ code: 'cancelled' })
    })

    it.each([
      ['NotAllowedError', 'cancelled'],
      ['AbortError', 'cancelled'],
      ['NotSupportedError', 'unsupported'],
      ['SecurityError', 'invalid-rp-id'],
      ['UnknownError', 'failed']
    ])('maps %s to %s', async (name, code) => {
      authenticator.failWith = new DOMException('failed', name)
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({ code })
    })
  })

  describe('consent prompts', () => {
    it.each([
      ['rejected', () => (authenticator.failWith = new DOMException('no', 'NotAllowedError'))],
      ['dismissed', () => (authenticator.returnNull = true)]
    ])('does not sign when the prompt is %s', async (_name, fail) => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      fail()

      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'cancelled'
      })
    })

    it('scopes the prompt to the account RP ID', async () => {
      const wallet = createWallet(accessor, { session: true, rpId: 'example.com' })
      await wallet.connect()
      getCalls = []

      await wallet.signTransactions([makePayment(wallet.activeAddress!)])
      expect(bareCalls()[0].publicKey!.rpId).toBe('example.com')
    })

    it('passes data requests to confirm', async () => {
      const confirm = vi.fn(() => 'silent' as const)
      const wallet = createWallet(accessor, { session: true, confirm })
      await wallet.connect()

      await wallet.signData(siwaData(), { scope: ScopeType.AUTH, encoding: 'base64' })
      expect(confirm).toHaveBeenCalledWith({
        type: 'data',
        siwa: expect.objectContaining({ domain: HOST, account_address: ADDRESS })
      })
    })

    it('keeps a session with idleTimeoutMs 0 without an idle lock', async () => {
      await createWallet(accessor, { session: { idleTimeoutMs: 0 } }).connect()
      expect(FakeKeyStore.instances[0].options.idleTimeoutMs).toBe(0)
      expect(FakeKeyStore.instances[0].options.maxAgeMs).toBe(60 * 60 * 1000)
    })

    it('passes the maximum age to the key store, and 0 for none', async () => {
      await createWallet(accessor, { session: { maxAgeMs: 5 * 60 * 1000 } }).connect()
      await createWallet(accessor, { session: { maxAgeMs: 0 } }).connect()
      expect(FakeKeyStore.instances.map((store) => store.options.maxAgeMs)).toEqual([
        5 * 60 * 1000,
        0
      ])
      expect(FakeKeyStore.instances[0].options.idleTimeoutMs).toBe(15 * 60 * 1000)
    })

    describe('lockWhenHidden', () => {
      let page: EventTarget & { visibilityState: DocumentVisibilityState }

      const setVisibility = (state: DocumentVisibilityState) => {
        page.visibilityState = state
        page.dispatchEvent(new Event('visibilitychange'))
      }

      beforeEach(() => {
        page = Object.assign(new EventTarget(), { visibilityState: 'visible' as const })
        vi.stubGlobal('document', page)
      })

      it('locks the session when the page is hidden', async () => {
        const wallet = createWallet(accessor, { session: { lockWhenHidden: true } })
        await wallet.connect()
        setVisibility('visible')
        expect(FakeKeyStore.instances[0].unlocked).toBe(true)

        setVisibility('hidden')
        expect(FakeKeyStore.instances[0].unlocked).toBe(false)

        setVisibility('visible')
        getCalls = []
        await wallet.signTransactions([makePayment(ADDRESS)])
        expect(prfCalls()).toHaveLength(1)
      })

      it('finishes a request that hides the page, then locks', async () => {
        const wallet = createWallet(accessor, { session: { lockWhenHidden: true } })
        await wallet.connect()

        // The presence prompt hides the page
        credentials.get.mockImplementationOnce((options: CredentialRequestOptions) => {
          setVisibility('hidden')
          return fakeGet(options)
        })
        const txn = makePayment(ADDRESS)
        const [signed] = await wallet.signTransactions([txn])

        expectValidSignature(signed!, txn)
        expect(FakeKeyStore.instances[0].unlocked).toBe(false)
      })

      it('keeps the session if the page is visible again when the request ends', async () => {
        const wallet = createWallet(accessor, { session: { lockWhenHidden: true } })
        await wallet.connect()

        credentials.get.mockImplementationOnce((options: CredentialRequestOptions) => {
          setVisibility('hidden')
          setVisibility('visible')
          return fakeGet(options)
        })
        await wallet.signData(siwaData(), { scope: ScopeType.AUTH, encoding: 'base64' })
        expect(FakeKeyStore.instances[0].unlocked).toBe(true)
      })

      it('locks a session that connects while the page is hidden', async () => {
        page.visibilityState = 'hidden'
        await createWallet(accessor, { session: { lockWhenHidden: true } }).connect()
        expect(FakeKeyStore.instances[0].unlocked).toBe(false)
      })

      it('applies to a custom key store', async () => {
        const keyStore = new (WorkerKeyStore as unknown as new () => PasskeyKeyStore)()
        const wallet = createWallet(accessor, {
          keyStore: () => keyStore,
          session: { lockWhenHidden: true }
        })
        await wallet.connect()
        expect(keyStore.unlocked).toBe(true)

        setVisibility('hidden')
        expect(keyStore.unlocked).toBe(false)
      })

      it('reports hidden locks to onLock', async () => {
        const onLock = vi.fn()
        const wallet = createWallet(accessor, { session: { lockWhenHidden: true }, onLock })
        await wallet.connect()
        setVisibility('hidden')
        expect(onLock.mock.calls).toEqual([['hidden']])

        // A lock at the end of a request the page was hidden during
        setVisibility('visible')
        await wallet.unlock()
        credentials.get.mockImplementationOnce((options: CredentialRequestOptions) => {
          setVisibility('hidden')
          return fakeGet(options)
        })
        await wallet.signTransactions([makePayment(ADDRESS)])
        expect(onLock.mock.calls).toEqual([['hidden'], ['hidden']])
      })

      it('follows a setting passed as a function', async () => {
        let setting = false
        const wallet = createWallet(accessor, { session: { lockWhenHidden: () => setting } })
        await wallet.connect()

        setVisibility('hidden')
        expect(wallet.isUnlocked).toBe(true)

        setVisibility('visible')
        setting = true
        setVisibility('hidden')
        expect(wallet.isUnlocked).toBe(false)
      })

      it('fails closed when the setting function throws', async () => {
        const wallet = createWallet(accessor, {
          session: {
            lockWhenHidden: () => {
              throw new Error('app bug')
            }
          }
        })
        await wallet.connect()
        setVisibility('hidden')
        expect(wallet.isUnlocked).toBe(false)
      })

      it('is off by default', async () => {
        await createWallet(accessor, { session: true }).connect()
        await createWallet(accessor, { session: { lockWhenHidden: false } }).connect()

        setVisibility('hidden')
        expect(FakeKeyStore.instances.map((store) => store.unlocked)).toEqual([true, true])
      })
    })
  })

  describe('unlock and lock', () => {
    it('unlocks a resumed session with one scoped PRF ceremony, so signing needs none', async () => {
      await createWallet(accessor, { session: true, confirm: () => 'silent' }).connect()
      const reloaded = createWallet(accessor, { session: true, confirm: () => 'silent' })
      await reloaded.resumeSession()
      getCalls = []
      expect(reloaded.isUnlocked).toBe(false)

      await reloaded.unlock()
      expect(reloaded.isUnlocked).toBe(true)
      expect(prfCalls()).toHaveLength(1)
      expect(
        new Uint8Array(prfCalls()[0].publicKey!.allowCredentials![0].id as Uint8Array)
      ).toEqual(CREDENTIAL_ID)

      await reloaded.unlock()
      const txn = makePayment(ADDRESS)
      const [signed] = await reloaded.signTransactions([txn])
      expectValidSignature(signed!, txn)
      expect(getCalls).toHaveLength(1)
    })

    it('does nothing without a session', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      getCalls = []

      await wallet.unlock()
      expect(getCalls).toHaveLength(0)
      expect(wallet.isUnlocked).toBe(false)
    })

    it('requires a connected account', async () => {
      await expect(createWallet(accessor, { session: true }).unlock()).rejects.toMatchObject({
        code: 'not-connected'
      })
    })

    it('fails closed and stays locked on a key mismatch', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      wallet.lock()
      authenticator.prfOutput = (input) => sha256(sha256(input))

      await expect(wallet.unlock()).rejects.toMatchObject({ code: 'key-mismatch' })
      expect(wallet.isUnlocked).toBe(false)
    })

    it('surfaces a cancelled prompt', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      wallet.lock()
      authenticator.failWith = new DOMException('no', 'NotAllowedError')

      await expect(wallet.unlock()).rejects.toMatchObject({ code: 'cancelled' })
      expect(wallet.isUnlocked).toBe(false)
    })

    it('locks without disconnecting, and the next signature unlocks again', async () => {
      const wallet = createWallet(accessor, { session: true })
      await wallet.connect()
      expect(wallet.isUnlocked).toBe(true)

      wallet.lock()
      expect(wallet.isUnlocked).toBe(false)
      expect(wallet.isConnected).toBe(true)

      getCalls = []
      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(prfCalls()).toHaveLength(1)
      expect(bareCalls()).toHaveLength(0)
    })

    describe('onLock and onUnlock', () => {
      it('reports lock() once, and nothing while already locked', async () => {
        const onLock = vi.fn()
        const wallet = createWallet(accessor, { session: true, onLock })
        await wallet.connect()

        wallet.lock()
        wallet.lock()
        expect(onLock.mock.calls).toEqual([['lock']])
      })

      it.each(['idle', 'max-age'] as const)('reports the key store %s timeout', async (reason) => {
        const onLock = vi.fn()
        const wallet = createWallet(accessor, { session: true, onLock })
        await wallet.connect()

        FakeKeyStore.instances[0].expire(reason)
        expect(onLock).toHaveBeenCalledWith(reason)
        expect(wallet.isUnlocked).toBe(false)
      })

      it('reports a disconnect', async () => {
        const onLock = vi.fn()
        const wallet = createWallet(accessor, { session: true, onLock })
        await wallet.connect()

        await wallet.disconnect()
        expect(onLock.mock.calls).toEqual([['disconnect']])
      })

      it('reports again after a reload and an unlock', async () => {
        await createWallet(accessor, { session: true }).connect()
        const onLock = vi.fn()
        const reloaded = createWallet(accessor, { session: true, onLock })
        await reloaded.resumeSession()

        reloaded.lock()
        expect(onLock).not.toHaveBeenCalled()

        await reloaded.unlock()
        reloaded.lock()
        expect(onLock.mock.calls).toEqual([['lock']])
      })

      it('reports a failed reconnect that dropped the session', async () => {
        const onLock = vi.fn()
        const wallet = createWallet(accessor, { session: true, onLock })
        await wallet.connect()
        authenticator.failWith = new DOMException('no', 'NotAllowedError')

        await expect(wallet.connect()).rejects.toMatchObject({ code: 'cancelled' })
        expect(onLock.mock.calls).toEqual([['connect']])
      })

      it('reports a key store that dropped the key during a request', async () => {
        const onLock = vi.fn()
        const keyStore = new (WorkerKeyStore as unknown as new () => PasskeyKeyStore)()
        const wallet = createWallet(accessor, {
          keyStore: () => keyStore,
          confirm: () => 'silent',
          onLock
        })
        await wallet.connect()
        vi.spyOn(keyStore, 'sign').mockImplementationOnce(async () => {
          keyStore.lock()
          throw new Error('worker crashed')
        })

        await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toThrow()
        expect(onLock.mock.calls).toEqual([['key-store']])
      })

      it('is never called without a session', async () => {
        const onLock = vi.fn()
        const onUnlock = vi.fn()
        const wallet = createWallet(accessor, { onLock, onUnlock })
        await wallet.connect()
        await wallet.signTransactions([makePayment(ADDRESS)])
        await wallet.unlock()
        wallet.lock()
        await wallet.disconnect()
        expect(onLock).not.toHaveBeenCalled()
        expect(onUnlock).not.toHaveBeenCalled()
      })

      it('reports unlocks from connect, unlock and a signature, once each', async () => {
        const onUnlock = vi.fn()
        const options = { session: true, confirm: () => 'silent' as const, onUnlock }
        const wallet = createWallet(accessor, options)
        await wallet.connect()
        expect(onUnlock).toHaveBeenCalledTimes(1)

        // Already unlocked: a signature and another unlock change nothing
        await wallet.signTransactions([makePayment(ADDRESS)])
        await wallet.unlock()
        expect(onUnlock).toHaveBeenCalledTimes(1)

        wallet.lock()
        await wallet.unlock()
        expect(onUnlock).toHaveBeenCalledTimes(2)

        // After a reload, the first signature's PRF ceremony unlocks
        const reloaded = createWallet(accessor, options)
        await reloaded.resumeSession()
        await reloaded.signTransactions([makePayment(ADDRESS)])
        expect(onUnlock).toHaveBeenCalledTimes(3)
      })

      it('reports nothing for a failed unlock', async () => {
        const onLock = vi.fn()
        const onUnlock = vi.fn()
        const wallet = createWallet(accessor, { session: true, onLock, onUnlock })
        await wallet.connect()
        wallet.lock()
        authenticator.failWith = new DOMException('no', 'NotAllowedError')

        await expect(wallet.unlock()).rejects.toMatchObject({ code: 'cancelled' })
        expect(onUnlock).toHaveBeenCalledTimes(1)
        expect(onLock).toHaveBeenCalledTimes(1)
      })

      it('keeps working when onLock or onUnlock throws', async () => {
        const wallet = createWallet(accessor, {
          session: true,
          onLock: () => {
            throw new Error('app bug')
          },
          onUnlock: () => {
            throw new Error('app bug')
          }
        })
        await expect(wallet.connect()).resolves.toHaveLength(1)

        expect(() => wallet.lock()).not.toThrow()
        expect(wallet.isUnlocked).toBe(false)
      })
    })

    it('reads the confirm policy on every request', async () => {
      let preference: PasskeyConfirmation = 'silent'
      const wallet = createWallet(accessor, { session: true, confirm: () => preference })
      await wallet.connect()
      getCalls = []

      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(getCalls).toHaveLength(0)

      preference = 'verify'
      await wallet.signTransactions([makePayment(ADDRESS)])
      expect(bareCalls().map((call) => call.publicKey!.userVerification)).toEqual(['required'])
    })
  })

  describe('custom RP ID', () => {
    it('creates, signs and resumes on the configured RP ID', async () => {
      const options = { rpId: 'example.com', rpName: 'Example dApp', context: 'my-app' }
      const wallet = createWallet(accessor, options)
      await wallet.connect({ create: true })

      expect(createCalls[0].publicKey!.rp.id).toBe('example.com')
      expect(createCalls[0].publicKey!.user.name).toBe('Example dApp account')
      expect(wallet.activeAccount!.name).toBe('Passkey · example.com')

      const resumed = createWallet(accessor, options)
      await resumed.resumeSession()
      getCalls = []
      await resumed.signTransactions([makePayment(resumed.activeAddress!)])
      expect(prfCalls()[0].publicKey!.rpId).toBe('example.com')
    })
  })

  describe('more edge cases', () => {
    it('signs a specific index in an encoded group', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      const own = makePayment(ADDRESS, 'own')
      const group = [makePayment(ADDRESS, 'a'), makePayment(ADDRESS, 'b'), own].map((txn) =>
        algosdk.encodeUnsignedTransaction(txn)
      )

      const signed = await wallet.signTransactions(group, [2])
      expect(signed).toHaveLength(1)
      expectValidSignature(signed[0]!, own)
    })

    it('refuses to export when not connected', async () => {
      await expect(createWallet(accessor).exportRecoveryPhrase()).rejects.toMatchObject({
        code: 'not-connected'
      })
      expect(getCalls).toHaveLength(0)
    })

    it('rejects a PRF output longer than 32 bytes', async () => {
      authenticator.prfOutput = () => new Uint8Array(64)
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({
        code: 'prf-unsupported'
      })
    })

    it('reports a browser without navigator.credentials', async () => {
      vi.stubGlobal('navigator', {})
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({ code: 'unsupported' })
    })

    it.each([
      ['cancelled', () => (authenticator.failWith = new DOMException('no', 'NotAllowedError'))],
      ['dismissed', () => (authenticator.returnNull = true)]
    ])('fails to create a passkey when the prompt is %s', async (_name, fail) => {
      fail()
      await expect(createWallet(accessor).connect({ create: true })).rejects.toMatchObject({
        code: 'cancelled'
      })
    })

    it('classifies an error thrown before the ceremony starts', async () => {
      authenticator.syncThrow = new DOMException('bad rp', 'SecurityError')
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({
        code: 'invalid-rp-id'
      })
    })

    it('rejects an answer whose credential ID is a prefix of the requested one', async () => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      authenticator.rawId = CREDENTIAL_ID.slice(0, 4)

      await expect(wallet.signTransactions([makePayment(ADDRESS)])).rejects.toMatchObject({
        code: 'key-mismatch'
      })
    })

    it('zeroes the PRF output and stores nothing when unlocking fails', async () => {
      let captured: Uint8Array | undefined
      const keyStore: PasskeyKeyStore = {
        unlocked: false,
        unlock: async (entropy) => {
          captured = entropy
          throw new Error('worker blocked')
        },
        sign: async () => new Uint8Array(),
        lock: () => {}
      }
      const wallet = createWallet(accessor, { keyStore: () => keyStore })

      await expect(wallet.connect()).rejects.toThrow('worker blocked')
      expect(wallet.isConnected).toBe(false)
      expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeUndefined()
      expect(captured!.every((byte) => byte === 0)).toBe(true)
    })

    it('pins the storage key, the account name and signData support', async () => {
      expect(LOCAL_STORAGE_PASSKEY_KEY).toBe('@txnlab/use-wallet:v5:passkey')
      const wallet = createWallet(accessor)
      expect(wallet.canSignData).toBe(true)
      const [account] = await wallet.connect({ create: true, userName: 'alice' })
      expect(account.name).toBe('Passkey · dapp.example')
      expect(createCalls[0].publicKey!.user.displayName).toBe('alice')
    })

    it('runs without localStorage (SSR)', async () => {
      vi.stubGlobal('localStorage', undefined)
      const wallet = createWallet(accessor)
      await expect(wallet.resumeSession()).resolves.toBeUndefined()
      await expect(wallet.disconnect()).resolves.toBeUndefined()
    })

    it.each([
      [
        'a numeric public key that atob accepts',
        (r: Record<string, unknown>) => (r.publicKey = 12345678)
      ],
      [
        'a credential ID array that atob accepts',
        (r: Record<string, unknown>) => (r.credentialId = ['AQIDBAUGBwg='])
      ]
    ])('disconnects on resume when the record has %s', async (_name, edit) => {
      await createWallet(accessor).connect()
      const record = JSON.parse(localStorageData[LOCAL_STORAGE_PASSKEY_KEY])
      edit(record)
      localStorageData[LOCAL_STORAGE_PASSKEY_KEY] = JSON.stringify(record)

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(false)
    })

    it.each([
      [
        'a UTF-8 BOM',
        (json: string) => new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(json)])
      ],
      [
        'invalid UTF-8 inside a string',
        (json: string) => {
          // A lenient decoder turns 0xff into U+FFFD, and the JSON still parses
          const bytes = new TextEncoder().encode(json)
          bytes[json.indexOf('"version":"1"') + '"version":"'.length] = 0xff
          return bytes
        }
      ]
    ])('rejects signData bytes with %s', async (_name, encode) => {
      const wallet = createWallet(accessor)
      await wallet.connect()
      const bytes = encode(atob(siwaData()))

      await expect(
        wallet.signData(algosdk.bytesToBase64(bytes), { scope: ScopeType.AUTH, encoding: 'base64' })
      ).rejects.toMatchObject({ code: 4609 })
    })

    it('keeps the error cause and wraps non-Error values', async () => {
      const cause = new DOMException('no', 'NotAllowedError')
      authenticator.failWith = cause
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({ cause })

      authenticator.failWith = 'boom' as unknown as Error
      await expect(createWallet(accessor).connect()).rejects.toMatchObject({
        code: 'failed',
        message: 'boom'
      })
    })

    it('counts context length in UTF-16 code units', () => {
      expect(() => createWallet(accessor, { context: '😀'.repeat(64) })).not.toThrow()
      expect(() => createWallet(accessor, { context: '😀'.repeat(65) })).toThrow()
    })
  })

  describe('rekeyed accounts', () => {
    /** Connects, then adds LEGACY, which algod reports as rekeyed to the passkey account */
    async function connectWithRekeyed(options?: PasskeyOptions) {
      algodAuthAddrs[LEGACY] = ADDRESS
      const wallet = createWallet(accessor, options)
      await wallet.connect()
      await wallet.addRekeyedAccount(LEGACY)
      return wallet
    }

    /** Lets background algod checks finish */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

    describe('addRekeyedAccount', () => {
      it('adds and persists an account rekeyed to the passkey account, without a prompt', async () => {
        algodAuthAddrs[LEGACY] = ADDRESS
        algodAuthAddrs[LEGACY_2] = ADDRESS
        const wallet = createWallet(accessor)
        await wallet.connect()
        getCalls = []

        const account = await wallet.addRekeyedAccount(LEGACY)
        await wallet.addRekeyedAccount(LEGACY_2)

        expect(account).toMatchObject({ name: 'Passkey · rekeyed', address: LEGACY })
        expect(wallet.addresses).toEqual([ADDRESS, LEGACY, LEGACY_2])
        expect(wallet.activeAddress).toBe(ADDRESS)
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY, LEGACY_2))
        expect(accountInformation).toHaveBeenCalledWith(LEGACY)
        expect(getCalls).toHaveLength(0)
      })

      it('persists only public data', async () => {
        await connectWithRekeyed()

        const record = storedRecord()
        expect(Object.keys(record).sort()).toEqual(
          [
            'address',
            'context',
            'credentialId',
            'publicKey',
            'rekeyedAccounts',
            'rpId',
            'salt',
            'version'
          ].sort()
        )
        expect(record.rekeyedAccounts).toEqual(onTestnet(LEGACY))
      })

      it('sets a pqsig empty signature that names the passkey account as sgnr', async () => {
        const wallet = await connectWithRekeyed()
        const [own, rekeyed] = wallet.accounts

        expect(getSignatureType(rekeyed.emptySignature)).toBe('pqsig')
        const fields = decodeEmptySignature(rekeyed.emptySignature!)
        expect(fields.sgnr?.toString()).toBe(ADDRESS)
        expect(algosdk.addressFromPQSig(fields.pqsig!).toString()).toBe(ADDRESS)
        expect(fields.pqsig).toEqual(decodeEmptySignature(own.emptySignature!).pqsig)
        expect(decodeEmptySignature(own.emptySignature!).sgnr).toBeUndefined()

        // Simulating with the empty signer names the passkey account as the authorizer
        const txns = [makePayment(LEGACY), makePayment(ADDRESS)]
        const [rekeyedStxn, ownStxn] = await wallet.emptyTransactionSigner(txns, [0, 1])
        expect(sgnrOf(rekeyedStxn)).toBe(ADDRESS)
        expect(algosdk.decodeSignedTransaction(rekeyedStxn).pqsig?.pk).toEqual(fields.pqsig!.pk)
        expect(sgnrOf(ownStxn)).toBeUndefined()
      })

      it.each([
        ['an account that is not rekeyed', undefined],
        ['an account rekeyed to another address', OTHER_ADDRESS]
      ])('refuses %s', async (_name, authAddr) => {
        algodAuthAddrs[LEGACY] = authAddr
        const wallet = createWallet(accessor)
        await wallet.connect()

        await expect(wallet.addRekeyedAccount(LEGACY)).rejects.toMatchObject({
          name: 'PasskeyError',
          code: 'not-rekeyed'
        })
        expect(wallet.addresses).toEqual([ADDRESS])
        expect(storedRecord().rekeyedAccounts).toBeUndefined()
      })

      it('fails on an algod error, and adds nothing', async () => {
        const wallet = createWallet(accessor)
        await wallet.connect()
        algodError = new Error('network down')

        await expect(wallet.addRekeyedAccount(LEGACY)).rejects.toMatchObject({
          code: 'failed',
          cause: algodError
        })
        expect(wallet.addresses).toEqual([ADDRESS])
        expect(storedRecord().rekeyedAccounts).toBeUndefined()
      })

      it('records an address in canonical form, and matches it in any form', async () => {
        algodAuthAddrs[LEGACY] = ADDRESS
        const wallet = createWallet(accessor)
        await wallet.connect()

        const account = await wallet.addRekeyedAccount(nonCanonical(LEGACY))
        await wallet.addRekeyedAccount(LEGACY)

        expect(account.address).toBe(LEGACY)
        expect(wallet.addresses).toEqual([ADDRESS, LEGACY])
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
        expect(accountInformation).toHaveBeenCalledWith(LEGACY)
        expect(accountInformation).not.toHaveBeenCalledWith(nonCanonical(LEGACY))

        wallet.removeRekeyedAccount(nonCanonical(LEGACY))
        expect(wallet.addresses).toEqual([ADDRESS])
      })

      it('restores an empty signature the manager cleared when the account is added again', async () => {
        const wallet = await connectWithRekeyed()
        const [own, rekeyed] = wallet.accounts
        const { emptySignature: _cleared, ...withoutEmptySignature } = rekeyed
        accessor.setAccounts([own, withoutEmptySignature])

        const again = await wallet.addRekeyedAccount(LEGACY)

        expect(again.emptySignature).toBe(rekeyed.emptySignature)
        expect(wallet.accounts[1].emptySignature).toBe(rekeyed.emptySignature)
      })

      it('returns the same account when added again', async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)

        const again = await wallet.addRekeyedAccount(LEGACY)

        expect(again.address).toBe(LEGACY)
        expect(wallet.addresses).toEqual([ADDRESS, LEGACY])
        expect(wallet.activeAddress).toBe(LEGACY)
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
      })

      it('drops an account it added before when algod reports another auth address', async () => {
        const wallet = await connectWithRekeyed()
        algodAuthAddrs[LEGACY] = OTHER_ADDRESS

        await expect(wallet.addRekeyedAccount(LEGACY)).rejects.toMatchObject({
          code: 'not-rekeyed'
        })
        expect(wallet.addresses).toEqual([ADDRESS])
        expect(storedRecord().rekeyedAccounts).toBeUndefined()
      })

      it('refuses the passkey account itself and invalid addresses, without asking algod', async () => {
        const wallet = createWallet(accessor)
        await wallet.connect()

        await expect(wallet.addRekeyedAccount(ADDRESS)).rejects.toMatchObject({
          code: 'not-rekeyed'
        })
        await expect(wallet.addRekeyedAccount(nonCanonical(ADDRESS))).rejects.toMatchObject({
          code: 'not-rekeyed'
        })
        await expect(wallet.addRekeyedAccount('not an address')).rejects.toMatchObject({
          code: 'failed'
        })
        expect(accountInformation).not.toHaveBeenCalled()
        expect(wallet.addresses).toEqual([ADDRESS])
      })

      it('requires a connected account', async () => {
        await expect(createWallet(accessor).addRekeyedAccount(LEGACY)).rejects.toMatchObject({
          code: 'not-connected'
        })
      })

      it('adds nothing when the wallet disconnects while algod answers', async () => {
        algodAuthAddrs[LEGACY] = ADDRESS
        const wallet = createWallet(accessor)
        await wallet.connect()
        let open!: () => void
        algodGate = new Promise((resolve) => (open = resolve))

        const adding = wallet.addRekeyedAccount(LEGACY)
        await wallet.disconnect()
        open()

        await expect(adding).rejects.toMatchObject({ code: 'not-connected' })
        expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeUndefined()
      })
    })

    it('reports the passkey address, whichever account is active', async () => {
      const wallet = createWallet(accessor)
      expect(wallet.passkeyAddress).toBeNull()

      algodAuthAddrs[LEGACY] = ADDRESS
      await wallet.connect()
      await wallet.addRekeyedAccount(LEGACY)
      wallet.setActiveAccount(LEGACY)

      expect(wallet.activeAddress).toBe(LEGACY)
      expect(wallet.passkeyAddress).toBe(ADDRESS)
    })

    describe('across reloads and sign-ins', () => {
      it('keeps rekeyed accounts across a reload, without a ceremony', async () => {
        await connectWithRekeyed()
        getCalls = []
        accountInformation.mockClear()

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()
        await settle()

        expect(reloaded.isConnected).toBe(true)
        expect(reloaded.addresses).toEqual([ADDRESS, LEGACY])
        expect(getCalls).toHaveLength(0)
        expect(accountInformation).toHaveBeenCalledWith(LEGACY)

        const txn = makePayment(LEGACY)
        const [signed] = await reloaded.signTransactions([txn])
        expectValidSignature(signed!, txn)
        expect(sgnrOf(signed!)).toBe(ADDRESS)
      })

      it('drops an account algod reports rekeyed elsewhere on resume, keeping the others', async () => {
        const wallet = await connectWithRekeyed()
        algodAuthAddrs[LEGACY_2] = ADDRESS
        await wallet.addRekeyedAccount(LEGACY_2)
        algodAuthAddrs[LEGACY] = OTHER_ADDRESS

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()

        await vi.waitFor(() => expect(reloaded.addresses).toEqual([ADDRESS, LEGACY_2]))
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY_2))
        expect(reloaded.isConnected).toBe(true)
      })

      it('activates the passkey account when resume drops the active rekeyed account', async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)
        algodAuthAddrs[LEGACY] = undefined

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()

        await vi.waitFor(() => expect(reloaded.addresses).toEqual([ADDRESS]))
        expect(reloaded.activeAddress).toBe(ADDRESS)
      })

      it('keeps rekeyed accounts when algod fails on resume', async () => {
        await connectWithRekeyed()
        algodError = new Error('network down')

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()
        await settle()

        expect(reloaded.addresses).toEqual([ADDRESS, LEGACY])
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
      })

      it('resumes without waiting for algod', async () => {
        await connectWithRekeyed()
        algodGate = new Promise(() => {})

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()

        expect(reloaded.isConnected).toBe(true)
        expect(reloaded.addresses).toEqual([ADDRESS, LEGACY])
      })

      it('restores rekeyed accounts the store lacks on resume', async () => {
        const wallet = await connectWithRekeyed()
        accessor.setAccounts([wallet.accounts[0]])

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()

        expect(reloaded.addresses).toEqual([ADDRESS, LEGACY])
        expect(reloaded.accounts[1].name).toBe('Passkey · rekeyed')
      })

      it('drops and rewrites nothing when every rekeyed account checks out', async () => {
        await connectWithRekeyed()
        algodAuthAddrs[LEGACY_2] = ADDRESS
        const record = storedRecord()
        record.rekeyedAccounts = onTestnet(LEGACY, LEGACY_2)
        localStorageData[LOCAL_STORAGE_PASSKEY_KEY] = JSON.stringify(record)

        const reloaded = createWallet(accessor)
        const { logger } = reloaded as unknown as { logger: { warn: () => void } }
        const warn = vi.spyOn(logger, 'warn')
        await reloaded.resumeSession()
        const accountsAfterResume = store.state.wallets[WALLET_ID]?.accounts
        mockLocalStorage.setItem.mockClear()
        await settle()

        expect(accountInformation).toHaveBeenCalledWith(LEGACY_2)
        expect(warn).not.toHaveBeenCalled()
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
        expect(store.state.wallets[WALLET_ID]?.accounts).toBe(accountsAfterResume)
        expect(reloaded.addresses).toEqual([ADDRESS, LEGACY, LEGACY_2])
      })

      it('lists the rekeyed account the record has in place of one it lacks, on resume', async () => {
        // Every rekeyed account has the same name and empty signature, so only the address differs
        await connectWithRekeyed()
        algodAuthAddrs[LEGACY_2] = ADDRESS
        const record = storedRecord()
        record.rekeyedAccounts = onTestnet(LEGACY_2)
        localStorageData[LOCAL_STORAGE_PASSKEY_KEY] = JSON.stringify(record)

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()
        expect(reloaded.addresses).toEqual([ADDRESS, LEGACY_2])
      })

      it('renames a rekeyed account the store holds under another name, on resume', async () => {
        const wallet = await connectWithRekeyed()
        const [own, rekeyed] = wallet.accounts
        accessor.setAccounts([own, { ...rekeyed, name: 'Old name' }])

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()
        expect(reloaded.accounts[1]).toMatchObject({ address: LEGACY, name: 'Passkey · rekeyed' })
      })

      it('leaves a store that no longer holds the passkey account alone when a check answers', async () => {
        await connectWithRekeyed()
        let openAlgod!: () => void
        algodGate = new Promise((resolve) => (openAlgod = resolve))
        await createWallet(accessor).resumeSession()

        // Before the check of LEGACY answers, the store stops holding the passkey account
        accessor.setAccounts([{ name: 'Other', address: OTHER_ADDRESS }])
        algodAuthAddrs[LEGACY] = OTHER_ADDRESS
        openAlgod()
        await settle()

        expect(storedRecord().rekeyedAccounts).toBeUndefined()
        expect(store.state.wallets[WALLET_ID]?.accounts).toEqual([
          { name: 'Other', address: OTHER_ADDRESS }
        ])
      })

      it('rebuilds a rekeyed account whose empty signature was cleared, on resume', async () => {
        const wallet = await connectWithRekeyed()
        const [own, rekeyed] = wallet.accounts
        const { emptySignature: _cleared, ...withoutEmptySignature } = rekeyed
        accessor.setAccounts([own, withoutEmptySignature])

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()
        expect(reloaded.accounts[1].emptySignature).toBe(rekeyed.emptySignature)
      })

      it('keeps and re-checks rekeyed accounts when the same passkey signs in again', async () => {
        await connectWithRekeyed()
        accountInformation.mockClear()

        const accounts = await createWallet(accessor).connect()

        expect(accounts.map((account) => account.address)).toEqual([ADDRESS, LEGACY])
        expect(store.state.wallets[WALLET_ID]?.activeAccount?.address).toBe(ADDRESS)
        await settle()
        expect(accountInformation).toHaveBeenCalledWith(LEGACY)
      })

      it("leaves another passkey's rekeyed accounts alone when a check from before it signed in answers", async () => {
        await connectWithRekeyed()
        let openAlgod!: () => void
        algodGate = new Promise((resolve) => (openAlgod = resolve))

        // The first passkey's resume starts checking LEGACY, and algod holds the answer
        await createWallet(accessor).resumeSession()

        // Meanwhile another passkey signs in, with LEGACY rekeyed to it on the same network
        authenticator.prfOutput = () => new Uint8Array(32).fill(7)
        const second = createWallet(accessor)
        const [{ address: secondAddress }] = await second.connect()
        const record = storedRecord()
        record.rekeyedAccounts = onTestnet(LEGACY)
        localStorageData[LOCAL_STORAGE_PASSKEY_KEY] = JSON.stringify(record)
        await second.resumeSession()
        expect(second.addresses).toEqual([secondAddress, LEGACY])

        // The first check answers that LEGACY isn't rekeyed to the first passkey
        algodAuthAddrs[LEGACY] = secondAddress
        openAlgod()
        await settle()

        expect(storedRecord().address).toBe(secondAddress)
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
        expect(second.addresses).toEqual([secondAddress, LEGACY])
      })

      it('keeps the active rekeyed account when the same passkey signs in again', async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)

        await createWallet(accessor).connect()

        expect(store.state.wallets[WALLET_ID]?.activeAccount?.address).toBe(LEGACY)
      })

      it('activates the passkey account when it signs in with rekeyed accounts but no wallet state', async () => {
        await connectWithRekeyed()
        accessor.removeWallet()

        const accounts = await createWallet(accessor).connect()

        expect(accounts.map((account) => account.address)).toEqual([ADDRESS, LEGACY])
        expect(store.state.wallets[WALLET_ID]?.activeAccount?.address).toBe(ADDRESS)
      })

      it('activates the passkey account when it connects after a disconnect', async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)
        await wallet.disconnect()

        await createWallet(accessor).connect()

        expect(store.state.wallets[WALLET_ID]?.activeAccount?.address).toBe(ADDRESS)
      })

      it('drops rekeyed accounts when another passkey signs in', async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)
        authenticator.prfOutput = () => new Uint8Array(32).fill(7)

        const accounts = await createWallet(accessor).connect()

        expect(accounts).toHaveLength(1)
        expect(accounts[0].address).not.toBe(ADDRESS)
        expect(storedRecord().rekeyedAccounts).toBeUndefined()
        expect(store.state.wallets[WALLET_ID]?.activeAccount?.address).toBe(accounts[0].address)
      })

      it('reconciles a store another tab left behind on resume, without disconnecting', async () => {
        // Tab A removes LEGACY, then tab B's store, which still lists it, is persisted
        const tabA = await connectWithRekeyed()
        const tabBAccounts = tabA.accounts
        tabA.removeRekeyedAccount(LEGACY)
        accessor.setAccounts(tabBAccounts)

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()

        expect(reloaded.isConnected).toBe(true)
        expect(reloaded.addresses).toEqual([ADDRESS])
        expect(storedRecord().address).toBe(ADDRESS)
      })

      it('signs from the record, not a store another tab left behind', async () => {
        const wallet = await connectWithRekeyed()
        const staleAccounts = wallet.accounts
        wallet.removeRekeyedAccount(LEGACY)
        accessor.setAccounts(staleAccounts)

        expect(await wallet.signTransactions([makePayment(LEGACY)])).toEqual([])
        const txn = makePayment(ADDRESS)
        const [signed] = await wallet.signTransactions([txn])
        expectValidSignature(signed!, txn)
      })
    })

    describe('networks', () => {
      const switchTo = async (networkId: string) => {
        store.setState((state) => ({ ...state, activeNetwork: networkId }))
        await settle()
      }

      it("lists only the active network's rekeyed accounts, and keeps the others", async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)
        // Mainnet's algod doesn't know the rekey
        algodAuthAddrs[LEGACY] = undefined
        accountInformation.mockClear()

        await switchTo('mainnet')
        expect(wallet.addresses).toEqual([ADDRESS])
        expect(wallet.activeAddress).toBe(ADDRESS)
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
        expect(accountInformation).not.toHaveBeenCalled()
        expect(await wallet.signTransactions([makePayment(LEGACY)])).toEqual([])

        algodAuthAddrs[LEGACY] = ADDRESS
        await switchTo('testnet')
        expect(wallet.addresses).toEqual([ADDRESS, LEGACY])
        expect(getSignatureType(wallet.accounts[1].emptySignature)).toBe('pqsig')
        expect(accountInformation).toHaveBeenCalledWith(LEGACY)
      })

      it("keeps another network's rekeyed accounts when a reload lands on a different one", async () => {
        await connectWithRekeyed()
        algodAuthAddrs[LEGACY] = undefined
        await switchTo('mainnet')

        const reloaded = createWallet(accessor)
        await reloaded.resumeSession()
        await settle()

        expect(reloaded.addresses).toEqual([ADDRESS])
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
      })

      it('records an account separately on each network', async () => {
        const wallet = await connectWithRekeyed()
        await switchTo('mainnet')
        await wallet.addRekeyedAccount(LEGACY)

        expect(storedRecord().rekeyedAccounts).toEqual([
          { address: LEGACY, network: TESTNET },
          { address: LEGACY, network: MAINNET }
        ])

        // Algod on mainnet reporting another auth address drops only mainnet's entry
        algodAuthAddrs[LEGACY] = OTHER_ADDRESS
        await expect(wallet.addRekeyedAccount(LEGACY)).rejects.toMatchObject({
          code: 'not-rekeyed'
        })
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))

        // And removing it on mainnet leaves testnet's alone
        algodAuthAddrs[LEGACY] = ADDRESS
        await wallet.addRekeyedAccount(LEGACY)
        wallet.removeRekeyedAccount(LEGACY)
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
      })

      it('records an account for the network algod answered on, even if it switched meanwhile', async () => {
        const wallet = await connectWithRekeyed()
        algodAuthAddrs[LEGACY_2] = ADDRESS
        let openAlgod!: () => void
        algodGate = new Promise((resolve) => (openAlgod = resolve))

        const adding = wallet.addRekeyedAccount(LEGACY_2)
        await switchTo('mainnet')
        openAlgod()
        await adding
        await settle()

        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY, LEGACY_2))
        expect(wallet.addresses).toEqual([ADDRESS])
      })

      it('checks nothing again on a store change that keeps the network', async () => {
        const wallet = await connectWithRekeyed()
        await settle()
        accountInformation.mockClear()

        wallet.setActiveAccount(LEGACY)
        accessor.setActive()
        await settle()

        expect(accountInformation).not.toHaveBeenCalled()
        expect(wallet.addresses).toEqual([ADDRESS, LEGACY])
      })

      it('refuses signData for an account recorded on another network, before prompting', async () => {
        const wallet = await connectWithRekeyed()
        await switchTo('mainnet')
        getCalls = []

        await expect(
          wallet.signData(siwaData({ account_address: LEGACY }), {
            scope: ScopeType.AUTH,
            encoding: 'base64'
          })
        ).rejects.toMatchObject({ code: 4603, message: 'Invalid Signer' })
        expect(getCalls).toHaveLength(0)
      })

      it('keys a network without a genesis hash by its ID', async () => {
        // The default LocalNet config has none
        store.setState((state) => ({ ...state, activeNetwork: 'localnet' }))
        await connectWithRekeyed()

        expect(storedRecord().rekeyedAccounts).toEqual([{ address: LEGACY, network: 'localnet' }])
      })

      describe('with a WalletManager', () => {
        let algodSpy: MockInstance

        beforeEach(() => {
          // The manager's own algod clients, and so the adapter's, answer from the mock
          const fromMock = (address: string) => accountInformation(String(address))
          algodSpy = vi
            .spyOn(algosdk.Algodv2.prototype, 'accountInformation')
            .mockImplementation(fromMock as unknown as algosdk.Algodv2['accountInformation'])
        })

        afterEach(() => algodSpy.mockRestore())

        it("checks a rekeyed account's sgnr empty signature, and lists it again after a network round trip", async () => {
          const manager = new WalletManager({ wallets: [passkey()] })
          const wallet = manager.getWallet(WALLET_ID) as unknown as PasskeyAdapter
          const accountOf = (address: string) =>
            manager.store.state.wallets[WALLET_ID]?.accounts.find((a) => a.address === address)

          await wallet.connect()
          algodAuthAddrs[LEGACY] = ADDRESS
          const added = await wallet.addRekeyedAccount(LEGACY)

          // The manager accepts the empty signature and records the passkey account as the auth address
          await vi.waitFor(() => expect(accountOf(LEGACY)?.authAddr).toBe(ADDRESS))
          expect(accountOf(LEGACY)?.emptySignature).toBe(added.emptySignature)
          expect(accountOf(ADDRESS)?.authAddr).toBeNull()

          // On mainnet, which doesn't know the rekey, it isn't listed but stays recorded
          algodAuthAddrs[LEGACY] = undefined
          await manager.setActiveNetwork('mainnet')
          await settle()
          expect(wallet.addresses).toEqual([ADDRESS])
          expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))

          // Back on testnet it's listed with its empty signature, and checked again
          algodAuthAddrs[LEGACY] = ADDRESS
          await manager.setActiveNetwork('testnet')
          await vi.waitFor(() => expect(accountOf(LEGACY)?.authAddr).toBe(ADDRESS))
          expect(accountOf(LEGACY)?.emptySignature).toBe(added.emptySignature)
        })
      })
    })

    describe('removeRekeyedAccount', () => {
      it('removes it from the wallet and the record, and stops signing for it', async () => {
        const wallet = await connectWithRekeyed()

        wallet.removeRekeyedAccount(LEGACY)

        expect(wallet.addresses).toEqual([ADDRESS])
        expect(storedRecord().rekeyedAccounts).toBeUndefined()
        expect(await wallet.signTransactions([makePayment(LEGACY)])).toEqual([])
      })

      it('activates the passkey account when it removes the active one', async () => {
        const wallet = await connectWithRekeyed()
        wallet.setActiveAccount(LEGACY)

        wallet.removeRekeyedAccount(LEGACY)
        expect(wallet.activeAddress).toBe(ADDRESS)
      })

      it('activates the passkey account, not the first one left, wherever the store lists it', async () => {
        const wallet = await connectWithRekeyed()
        algodAuthAddrs[LEGACY_2] = ADDRESS
        await wallet.addRekeyedAccount(LEGACY_2)
        accessor.setAccounts([...wallet.accounts].reverse())
        wallet.setActiveAccount(LEGACY)

        wallet.removeRekeyedAccount(LEGACY)
        expect(wallet.addresses).toEqual([ADDRESS, LEGACY_2])
        expect(wallet.activeAddress).toBe(ADDRESS)
      })

      it('ignores the passkey account itself and unknown addresses', async () => {
        const wallet = await connectWithRekeyed()

        wallet.removeRekeyedAccount(ADDRESS)
        wallet.removeRekeyedAccount(OTHER_ADDRESS)

        expect(wallet.addresses).toEqual([ADDRESS, LEGACY])
        expect(storedRecord().rekeyedAccounts).toEqual(onTestnet(LEGACY))
      })

      it('requires a connected account', () => {
        expect(() => createWallet(accessor).removeRekeyedAccount(LEGACY)).toThrow(
          'No passkey account is connected.'
        )
      })
    })

    it('disconnect clears rekeyed accounts', async () => {
      const wallet = await connectWithRekeyed()

      await wallet.disconnect()
      expect(wallet.isConnected).toBe(false)
      expect(localStorageData[LOCAL_STORAGE_PASSKEY_KEY]).toBeUndefined()

      const accounts = await wallet.connect()
      expect(accounts.map((account) => account.address)).toEqual([ADDRESS])
    })

    describe('signTransactions', () => {
      it('signs its own and its rekeyed accounts with one prompt, with sgnr only for the rekeyed', async () => {
        const wallet = await connectWithRekeyed()
        getCalls = []

        const txns = [makePayment(ADDRESS), makePayment(LEGACY), makePayment(OTHER_ADDRESS)]
        algosdk.assignGroupID(txns)
        const signed = await wallet.signTransactions(txns)

        expect(signed).toHaveLength(2)
        expectValidSignature(signed[0]!, txns[0])
        expectValidSignature(signed[1]!, txns[1])
        expect(sgnrOf(signed[0]!)).toBeUndefined()
        expect(sgnrOf(signed[1]!)).toBe(ADDRESS)
        expect(prfCalls()).toHaveLength(1)
      })

      it('signs an encoded transaction from a rekeyed account with sgnr', async () => {
        const wallet = await connectWithRekeyed()

        const txn = makePayment(LEGACY)
        const [signed] = await wallet.signTransactions([algosdk.encodeUnsignedTransaction(txn)])

        expectValidSignature(signed!, txn)
        expect(sgnrOf(signed!)).toBe(ADDRESS)
      })

      it('passes rekeyed transactions to confirm', async () => {
        const confirm = vi.fn(() => 'silent' as const)
        const wallet = await connectWithRekeyed({ session: true, confirm })

        const txn = makePayment(LEGACY)
        await wallet.signTransactions([txn, makePayment(OTHER_ADDRESS)])
        expect(confirm).toHaveBeenLastCalledWith({ type: 'transactions', transactions: [txn] })
      })

      describe('a migration group', () => {
        /** [LEGACY rekeys itself to `rekeyTo`, LEGACY's proof transaction] */
        function migrationGroup(rekeyTo = ADDRESS) {
          const txns = [makePayment(LEGACY, 'rekey', rekeyTo), makePayment(LEGACY, 'proof')]
          return algosdk.assignGroupID(txns)
        }

        it('signs the proof transaction after the rekey to the passkey account, with sgnr', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()
          const group = migrationGroup()

          const signed = await wallet.signTransactions(group, [1])
          expect(signed).toHaveLength(1)
          expectValidSignature(signed[0]!, group[1])
          expect(sgnrOf(signed[0]!)).toBe(ADDRESS)

          // Without indexes, the rekey itself is left to the account's own key
          const all = await wallet.signTransactions(group)
          expect(all).toHaveLength(1)
          expectValidSignature(all[0]!, group[1])
        })

        it('signs the proof transaction of an encoded group with the rekey already signed', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()
          const group = migrationGroup()
          const encoded = [
            algosdk.signTransaction(group[0], LEGACY_ACCOUNT.sk).blob,
            algosdk.encodeUnsignedTransaction(group[1])
          ]

          const signed = await wallet.signTransactions(encoded)
          expect(signed).toHaveLength(1)
          expectValidSignature(signed[0]!, group[1])
          expect(sgnrOf(signed[0]!)).toBe(ADDRESS)
        })

        it('skips a transaction the group rekeys to the passkey account only after it', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()
          getCalls = []
          const group = migrationGroup().reverse()

          expect(await wallet.signTransactions(group)).toEqual([])
          const encoded = group.map((txn) => algosdk.encodeUnsignedTransaction(txn))
          expect(await wallet.signTransactions(encoded)).toEqual([])
          expect(getCalls).toHaveLength(0)
        })

        it('skips a transaction after a rekey to another address', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()
          getCalls = []
          const group = migrationGroup(OTHER_ADDRESS)

          expect(await wallet.signTransactions(group)).toEqual([])
          const encoded = group.map((txn) => algosdk.encodeUnsignedTransaction(txn))
          expect(await wallet.signTransactions(encoded)).toEqual([])
          expect(getCalls).toHaveLength(0)
        })

        it('skips a sender that is neither its own, rekeyed, nor rekeyed in the group', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()

          expect(await wallet.signTransactions([makePayment(LEGACY)])).toEqual([])
        })

        it('ignores a rekey outside the transaction group', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()
          getCalls = []

          // Neither transaction in a group
          const ungrouped = [makePayment(LEGACY, 'rekey', ADDRESS), makePayment(LEGACY, 'proof')]
          expect(await wallet.signTransactions(ungrouped)).toEqual([])

          // The rekey in one group and the transaction in another, nested or flat
          const [rekey] = algosdk.assignGroupID([makePayment(LEGACY, 'rekey', ADDRESS)])
          const [proof] = algosdk.assignGroupID([makePayment(LEGACY, 'proof')])
          expect(await wallet.signTransactions([[rekey], [proof]])).toEqual([])
          expect(await wallet.signTransactions([rekey, proof])).toEqual([])
          const [encodedRekey, encodedProof] = [rekey, proof].map((txn) =>
            algosdk.encodeUnsignedTransaction(txn)
          )
          expect(await wallet.signTransactions([[encodedRekey], [encodedProof]])).toEqual([])
          expect(getCalls).toHaveLength(0)
        })

        it('treats an all-zero group as no group', async () => {
          // A Transaction object can carry one; encoding drops it, so only the object path sees it
          const wallet = createWallet(accessor)
          await wallet.connect()
          getCalls = []
          const txns = [makePayment(LEGACY, 'rekey', ADDRESS), makePayment(LEGACY, 'proof')]
          for (const txn of txns) txn.group = new Uint8Array(32)

          expect(await wallet.signTransactions(txns)).toEqual([])
          expect(getCalls).toHaveLength(0)
        })

        it('signs the proof transaction of its own group among nested groups', async () => {
          const wallet = createWallet(accessor)
          await wallet.connect()
          const otherGroup = algosdk.assignGroupID([makePayment(LEGACY, 'other rekey', ADDRESS)])
          const group = migrationGroup()

          const signed = await wallet.signTransactions([otherGroup, group])
          expect(signed).toHaveLength(1)
          expectValidSignature(signed[0]!, group[1])
          expect(sgnrOf(signed[0]!)).toBe(ADDRESS)
        })
      })

      it('stops signing for an account once an earlier transaction rekeys it away', async () => {
        const wallet = await connectWithRekeyed()

        const group = algosdk.assignGroupID([
          makePayment(LEGACY, 'move', OTHER_ADDRESS),
          makePayment(LEGACY, 'after'),
          makePayment(ADDRESS, 'own move', OTHER_ADDRESS),
          makePayment(ADDRESS, 'own after')
        ])
        const signed = await wallet.signTransactions(group)

        expect(signed).toHaveLength(2)
        expectValidSignature(signed[0]!, group[0])
        expect(sgnrOf(signed[0]!)).toBe(ADDRESS)
        expectValidSignature(signed[1]!, group[2])
        expect(sgnrOf(signed[1]!)).toBeUndefined()
      })
    })

    describe('signData', () => {
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }

      it("signs a SIWA request for a rekeyed account with the passkey's key", async () => {
        const wallet = await connectWithRekeyed()
        const { pqsig } = decodeEmptySignature(wallet.accounts[0].emptySignature!)
        accountInformation.mockClear()
        const data = siwaData({ account_address: LEGACY })

        const response = await wallet.signData(data, metadata)

        expect(wallet.activeAddress).toBe(ADDRESS)
        expect(accountInformation).toHaveBeenCalledWith(LEGACY)
        expect(response.scheme).toBe('falcon-1024-det')
        expect(response.signer).toEqual(pqsig!.pk)
        const message = new Uint8Array([
          ...sha256(new TextEncoder().encode(atob(data))),
          ...sha256(response.authenticatorData)
        ])
        expect(verifyCompressed(response.signer, response.signature, message)).toBe(true)
      })

      it.each([
        ['the passkey account', ADDRESS],
        ['a rekeyed account', LEGACY]
      ])(
        'signs for %s named with other padding bits, checking its canonical address',
        async (_name, address) => {
          const wallet = await connectWithRekeyed()
          accountInformation.mockClear()

          const response = await wallet.signData(
            siwaData({ account_address: nonCanonical(address) }),
            metadata
          )

          expect(response.scheme).toBe('falcon-1024-det')
          expect(accountInformation).toHaveBeenCalledWith(address)
          expect(accountInformation).not.toHaveBeenCalledWith(nonCanonical(address))
        }
      )

      it('refuses an account that was not added, before prompting', async () => {
        algodAuthAddrs[LEGACY] = ADDRESS
        const wallet = createWallet(accessor)
        await wallet.connect()
        getCalls = []

        await expect(
          wallet.signData(siwaData({ account_address: LEGACY }), metadata)
        ).rejects.toMatchObject({ code: 4603, message: 'Invalid Signer' })
        expect(getCalls).toHaveLength(0)
      })

      it('refuses a rekeyed account algod reports rekeyed elsewhere', async () => {
        const wallet = await connectWithRekeyed()
        algodAuthAddrs[LEGACY] = OTHER_ADDRESS

        await expect(
          wallet.signData(siwaData({ account_address: LEGACY }), metadata)
        ).rejects.toMatchObject({ code: 4603 })
      })
    })
  })
})
