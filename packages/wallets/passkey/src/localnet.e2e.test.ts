/**
 * End to end on AlgoKit LocalNet (`algokit localnet start`), skipped unless LOCALNET_E2E is set:
 * LOCALNET_E2E=1 pnpm --filter @txnlab/use-wallet-passkey test -- localnet
 *
 * An ed25519 account moves to the passkey account the way an app upgrading a legacy login does: one group
 * with its rekey (signed by its own key) and a 0-ALGO proof from it signed by the passkey. The real AVM
 * checks the signatures, so this is what the unit tests' fakes can't show.
 */
import { createHash } from 'node:crypto'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import { generateKey, signCompressed, verifyCompressed } from 'falcon-1024'
import { NetworkId, ScopeType, WalletManager, type Siwa } from '@txnlab/use-wallet'
import { decodeEmptySignature } from '@txnlab/use-wallet/adapter'
import { passkey } from './index'
import { keygenSeedFromEntropy } from './derivation'
import type { PasskeyAdapter } from './adapter'
import type { PasskeyKeyStore } from './key-store'

const run = !!process.env.LOCALNET_E2E

const HOST = 'localhost:5173'
const algod = new algosdk.Algodv2('a'.repeat(64), 'http://localhost', 4001)
const kmd = new algosdk.Kmd('a'.repeat(64), 'http://localhost', 4002)

const sha256 = (bytes: Uint8Array) => new Uint8Array(createHash('sha256').update(bytes).digest())

/** The worker key store's derivation and signing, run in Node */
class NodeKeyStore implements PasskeyKeyStore {
  private privateKey: Uint8Array | null = null
  get unlocked() {
    return this.privateKey !== null
  }
  async unlock(entropy: Uint8Array) {
    const keys = generateKey(keygenSeedFromEntropy(entropy))
    entropy.fill(0)
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

/** A platform authenticator with PRF, whose output is fixed per run */
function stubAuthenticator(prfOutput: Uint8Array) {
  class Credential {
    constructor(
      public rawId: ArrayBuffer,
      private extensions: AuthenticationExtensionsClientOutputs
    ) {}
    getClientExtensionResults() {
      return this.extensions
    }
  }
  const rawId = new Uint8Array([1, 2, 3, 4]).buffer
  vi.stubGlobal('PublicKeyCredential', Credential)
  vi.stubGlobal('navigator', {
    credentials: {
      create: async () => new Credential(rawId, {}),
      get: async (options: CredentialRequestOptions) =>
        new Credential(
          rawId,
          options.publicKey?.extensions?.prf
            ? { prf: { results: { first: new Uint8Array(prfOutput).buffer } } }
            : {}
        )
    }
  })
}

let storage: Record<string, string> = {}

/** A LocalNet dispenser account, from KMD's default wallet */
async function dispenser(): Promise<algosdk.Account> {
  const { wallets } = await kmd.listWallets()
  const wallet = wallets.find((w: { name: string }) => w.name === 'unencrypted-default-wallet')
  const { wallet_handle_token: handle } = await kmd.initWalletHandle(wallet.id, '')
  try {
    const { addresses } = await kmd.listKeys(handle)
    for (const address of addresses as string[]) {
      const info = await algod.accountInformation(address).do()
      if (info.amount > 10_000_000_000n) {
        const { private_key: sk } = await kmd.exportKey(handle, '', address)
        return { addr: algosdk.Address.fromString(address), sk }
      }
    }
    throw new Error('No funded LocalNet account')
  } finally {
    await kmd.releaseWalletHandle(handle)
  }
}

async function send(signed: Uint8Array[]) {
  const { txid } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txid, 10)
  return txid
}

async function fund(from: algosdk.Account, to: string) {
  const params = await algod.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: from.addr,
    receiver: to,
    amount: 1_000_000,
    suggestedParams: params
  })
  await send([txn.signTxn(from.sk)])
}

const payToSelf = (
  params: algosdk.SuggestedParams,
  account: string,
  fee: number,
  rekeyTo?: string
) =>
  algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account,
    receiver: account,
    amount: 0,
    rekeyTo,
    suggestedParams: { ...params, flatFee: true, fee }
  })

/** [the rekey to `to`, paying 4000 for both, signed by the old key; the proof, fee 0] */
async function upgradeGroup(account: string, to: string) {
  const params = await algod.getTransactionParams().do()
  return algosdk.assignGroupID([
    payToSelf(params, account, 4000, to),
    payToSelf(params, account, 0)
  ])
}

const authAddrOf = async (address: string) =>
  (await algod.accountInformation(address).exclude('all').do()).authAddr?.toString() ?? null

describe.skipIf(!run)('LocalNet: moving an account to the passkey account', () => {
  let manager: WalletManager
  let wallet: PasskeyAdapter
  let funder: algosdk.Account

  beforeAll(async () => {
    funder = await dispenser()
  })

  beforeEach(async () => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => void (storage[key] = value),
      removeItem: (key: string) => void delete storage[key],
      clear: () => void (storage = {})
    })
    vi.stubGlobal('location', { hostname: 'localhost', host: HOST })
    stubAuthenticator(crypto.getRandomValues(new Uint8Array(32)))

    manager = new WalletManager({
      wallets: [passkey({ keyStore: () => new NodeKeyStore() })],
      defaultNetwork: NetworkId.LOCALNET
    })
    wallet = manager.getWallet('passkey') as unknown as PasskeyAdapter
    await wallet.connect()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rekeys in one group, then signs transactions and SIWA for the account', async () => {
    const passkeyAddress = wallet.passkeyAddress!
    const legacy = algosdk.generateAccount()
    const L = legacy.addr.toString()
    await fund(funder, L)

    const group = await upgradeGroup(L, passkeyAddress)
    const [proof] = await wallet.signTransactions(group, [1])
    expect(algosdk.decodeSignedTransaction(proof!).sgnr?.toString()).toBe(passkeyAddress)
    await send([group[0].signTxn(legacy.sk), proof!])
    expect(await authAddrOf(L)).toBe(passkeyAddress)

    // The manager checks the added account's empty signature against algod and records the rekey
    await wallet.addRekeyedAccount(L)
    await vi.waitFor(() =>
      expect(
        manager.store.state.wallets['passkey']?.accounts.find((a) => a.address === L)
      ).toMatchObject({
        authAddr: passkeyAddress
      })
    )
    const account = manager.store.state.wallets['passkey']!.accounts.find((a) => a.address === L)!
    expect(decodeEmptySignature(account.emptySignature!)).toMatchObject({
      pqsig: expect.anything(),
      sgnr: algosdk.Address.fromString(passkeyAddress)
    })

    // The passkey alone now signs for the account (3 fee units for a Falcon signature)
    const params = await algod.getTransactionParams().do()
    const later = payToSelf(params, L, 3000)
    const [signed] = await wallet.signTransactions([later])
    await send([signed!])

    // SIWA for the account, signed by the passkey's key as a verifier checks it
    wallet.setActiveAccount(L)
    const siwa: Siwa = {
      domain: HOST,
      chain_id: 'algorand:localnet',
      account_address: L,
      type: 'falcon-1024-det',
      uri: `http://${HOST}`,
      version: '1',
      'issued-at': new Date().toISOString()
    }
    const data = btoa(canonify(siwa)!)
    const response = await wallet.signData(data, { scope: ScopeType.AUTH, encoding: 'base64' })
    expect(
      algosdk.encodeAddress(
        algosdk.addressFromPQKey(algosdk.FALCON_1024_SCHEME, response.signer).address.publicKey
      )
    ).toBe(passkeyAddress)
    const message = new Uint8Array([
      ...sha256(algosdk.base64ToBytes(data)),
      ...sha256(response.authenticatorData)
    ])
    expect(verifyCompressed(response.signer, response.signature, message)).toBe(true)
  })

  it("leaves the account as it was when another passkey's key signs the proof", async () => {
    const passkeyAddress = wallet.passkeyAddress!
    const legacy = algosdk.generateAccount()
    const L = legacy.addr.toString()
    await fund(funder, L)

    // A different Falcon key, signing the proof for the account rekeyed to this passkey
    const other = generateKey(crypto.getRandomValues(new Uint8Array(32)))
    const otherSigner = algosdk.addressWithSignersFromRawFalcon1024Signer(
      {
        falcon1024PublicKey: other.publicKey,
        falcon1024Signer: async (b) => signCompressed(other.privateKey, b)
      },
      legacy.addr
    )
    const group = await upgradeGroup(L, passkeyAddress)
    const [wrongProof] = await otherSigner.txnSigner(group, [1])

    await expect(send([group[0].signTxn(legacy.sk), wrongProof])).rejects.toThrow()
    expect(await authAddrOf(L)).toBeNull()
    await expect(wallet.addRekeyedAccount(L)).rejects.toMatchObject({ code: 'not-rekeyed' })
  })

  it("doesn't sign a proof for an account the group rekeys elsewhere", async () => {
    const legacy = algosdk.generateAccount()
    const L = legacy.addr.toString()
    await fund(funder, L)

    const group = await upgradeGroup(L, algosdk.generateAccount().addr.toString())
    expect(await wallet.signTransactions(group, [1])).toEqual([])
  })
})
