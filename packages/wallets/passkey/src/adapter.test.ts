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
import { createTestHarness, type State, type Store } from '@txnlab/use-wallet/testing'
import { PasskeyAdapter, type PasskeyConfirmation, type PasskeyOptions } from './adapter'
import { prfInput } from './derivation'
import { WorkerKeyStore, type PasskeyKeyStore } from './key-store'
import { LOCAL_STORAGE_PASSKEY_KEY } from './record'

// Stand in for the worker key store with the same derivation, run in Node
vi.mock('./key-store', async () => {
  const { generateKey, signCompressed } = await import('falcon-1024')
  const { keygenSeedFromEntropy } = await import('./derivation')

  class WorkerKeyStore {
    static instances: WorkerKeyStore[] = []
    private privateKey: Uint8Array | null = null

    constructor(public options: { idleTimeoutMs?: number } = {}) {
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
  }

  return { WorkerKeyStore }
})

const FakeKeyStore = WorkerKeyStore as unknown as {
  instances: (PasskeyKeyStore & { options: { idleTimeoutMs?: number } })[]
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

function createWallet(accessor: AdapterStoreAccessor, options?: PasskeyOptions): PasskeyAdapter {
  return new PasskeyAdapter({
    id: WALLET_ID,
    metadata: PasskeyAdapter.defaultMetadata,
    store: accessor,
    subscribe: vi.fn(),
    getAlgodClient: () =>
      ({
        accountInformation: () => ({
          do: async () =>
            algodAuthAddr ? { authAddr: algosdk.Address.fromString(algodAuthAddr) } : {}
        })
      }) as unknown as algosdk.Algodv2,
    options
  })
}

function makePayment(sender: string, note?: string): algosdk.Transaction {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: sender,
    amount: 0,
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

function expectValidSignature(signed: Uint8Array, txn: algosdk.Transaction) {
  const decoded = algosdk.decodeSignedTransaction(signed)
  expect(decoded.pqsig).toBeDefined()
  expect(algosdk.addressFromPQSig(decoded.pqsig!).toString()).toBe(ADDRESS)
  expect(verifyCompressed(decoded.pqsig!.pk, decoded.pqsig!.sig, txn.bytesToSign())).toBe(true)
}

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
    it('uses a 15-minute idle timeout for a session, and none without one', async () => {
      await createWallet(accessor, { session: true }).connect()
      await createWallet(accessor).connect()
      await createWallet(accessor, { session: false }).connect()

      expect(FakeKeyStore.instances.map((store) => store.options.idleTimeoutMs)).toEqual([
        15 * 60 * 1000,
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

    it('disconnects on resume when the store holds more than one account', async () => {
      await createWallet(accessor).connect()
      const [account] = store.state.wallets[WALLET_ID]!.accounts
      accessor.setAccounts([account, { name: 'Other', address: OTHER_ADDRESS }])

      const wallet = createWallet(accessor)
      await wallet.resumeSession()
      expect(wallet.isConnected).toBe(false)
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
    })
  })

  describe('custom RP ID', () => {
    it('creates, signs and resumes on the configured RP ID', async () => {
      const options = { rpId: 'example.com', rpName: 'Example dApp', context: 'my-app' }
      const wallet = createWallet(accessor, options)
      await wallet.connect({ create: true })

      expect(createCalls[0].publicKey!.rp.id).toBe('example.com')
      expect(createCalls[0].publicKey!.user.name).toBe('Example dApp account')

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
      expect(account.name).toBe('Passkey Account')
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
})
