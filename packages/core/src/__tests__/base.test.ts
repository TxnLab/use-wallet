import algosdk from 'algosdk'
import { encodeEmptySignature } from 'src/empty-signature'
import { recordEmptySignatureChecks } from 'src/store'
import { createMockAlgodClient, createTestHarness } from 'src/testing'
import { BaseWallet } from 'src/wallets/base'
import { SignDataError } from 'src/wallets/types'
import type { AdapterConstructorParams, WalletAccount } from 'src/wallets/types'
import type { MockInstance } from 'vitest'

vi.mock('src/logger', () => ({
  logger: {
    createScopedLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

class TestWallet extends BaseWallet {
  public connect = vi.fn().mockResolvedValue([])
  public disconnect = vi.fn().mockResolvedValue(undefined)
  public resumeSession = vi.fn().mockResolvedValue(undefined)
  public signTransactions = vi.fn().mockResolvedValue([])

  constructor(params: AdapterConstructorParams) {
    super(params)
  }

  public createStdSignDataForTest(data: string) {
    return this.createStdSignData(data)
  }

  public applyEmptySignaturesForTest(emptySignatures: unknown) {
    this.applyEmptySignatures(emptySignatures)
  }
}

const suggestedParams = {
  fee: 1000,
  minFee: 1000,
  firstValid: 1,
  lastValid: 1000,
  genesisHash: new Uint8Array(32),
  flatFee: true
}

function makeTxn(sender: string | algosdk.Address) {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
    amount: 0,
    suggestedParams
  })
}

function makeFalconAccount(sendingAddress?: algosdk.Address) {
  return algosdk.addressWithSignersFromRawFalcon1024Signer(
    {
      falcon1024PublicKey: crypto.getRandomValues(new Uint8Array(1793)),
      falcon1024Signer: async () => new Uint8Array(0)
    },
    sendingAddress
  )
}

function createWalletWithStore(accounts: WalletAccount[]) {
  const { accessor, store } = createTestHarness('test')
  const wallet = new TestWallet({
    id: 'test',
    metadata: { name: 'Test', icon: '' },
    store: accessor,
    subscribe: () => () => {},
    getAlgodClient: createMockAlgodClient
  })
  accessor.addWallet({ accounts, activeAccount: accounts[0] })
  return { wallet, store }
}

function createWallet(accounts: WalletAccount[]) {
  return createWalletWithStore(accounts).wallet
}

describe('emptyTransactionSigner', () => {
  it("signs each transaction with its sender's empty signature", async () => {
    const falcon = makeFalconAccount()
    const ed25519Address = algosdk.generateAccount().addr.toString()
    const txns = [makeTxn(falcon.address), makeTxn(ed25519Address)]
    const [expectedPqStxn] = await falcon.emptyTxnSigner([txns[0]], [0])
    const { pqsig } = algosdk.decodeSignedTransaction(expectedPqStxn)

    const wallet = createWallet([
      {
        name: 'PQ',
        address: falcon.address.toString(),
        emptySignature: encodeEmptySignature({ pqsig: pqsig! })
      },
      { name: 'Ed25519', address: ed25519Address, emptySignature: 'gA==' }
    ])

    const [pqStxn, edStxn] = await wallet.emptyTransactionSigner(txns, [0, 1])

    expect(pqStxn).toEqual(expectedPqStxn)
    expect(edStxn).toEqual((await algosdk.makeEmptyTransactionSigner()([txns[1]], [0]))[0])
  })

  it('only returns the transactions at indexesToSign', async () => {
    const address = algosdk.generateAccount().addr.toString()
    const txns = [makeTxn(address), makeTxn(address), makeTxn(address)]
    const wallet = createWallet([{ name: 'Account', address, emptySignature: 'gA==' }])

    const stxns = await wallet.emptyTransactionSigner(txns, [2])

    expect(stxns).toHaveLength(1)
    expect(algosdk.decodeSignedTransaction(stxns[0]).txn.txID()).toBe(txns[2].txID())
  })

  it('leaves the signature out for unknown, invalid or unconnected senders', async () => {
    const unknown = algosdk.generateAccount().addr.toString()
    const invalid = algosdk.generateAccount().addr.toString()
    const unconnected = algosdk.generateAccount().addr.toString()
    const txns = [makeTxn(unknown), makeTxn(invalid), makeTxn(unconnected)]
    const wallet = createWallet([
      { name: 'Unknown', address: unknown },
      { name: 'Invalid', address: invalid, emptySignature: 'AQ==' }
    ])

    const stxns = await wallet.emptyTransactionSigner(txns, [0, 1, 2])

    expect(stxns).toEqual(await algosdk.makeEmptyTransactionSigner()(txns, [0, 1, 2]))
  })
})

describe('createStdSignData', () => {
  const domain = 'arc60.example'
  let accountInformation: MockInstance<algosdk.Algodv2['accountInformation']>

  beforeEach(() => {
    vi.stubGlobal('location', { host: domain })
    accountInformation = vi.spyOn(algosdk.Algodv2.prototype, 'accountInformation')
    mockAuthAddr(null)
  })

  afterEach(() => {
    accountInformation.mockRestore()
    vi.unstubAllGlobals()
  })

  /** Stubs algod's account information with the given auth address */
  function mockAuthAddr(authAddr: algosdk.Address | null) {
    accountInformation.mockReturnValue({
      do: () => Promise.resolve({ authAddr: authAddr ?? undefined })
    } as unknown as ReturnType<algosdk.Algodv2['accountInformation']>)
  }

  /** An account's pqsig and empty signature, taken from algosdk's own empty signer */
  async function getEmptySignature(account: algosdk.AddressWithEmptyTransactionSigner) {
    const [stxn] = await account.emptyTxnSigner([makeTxn(account.address)], [0])
    const { pqsig, sgnr } = algosdk.decodeSignedTransaction(stxn)
    return {
      pqsig: pqsig!,
      emptySignature: encodeEmptySignature({ pqsig: pqsig!, ...(sgnr && { sgnr }) })
    }
  }

  async function sha256(text: string) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  }

  it.each([
    ['an ed25519', 'gA=='],
    ['an unknown', undefined]
  ])("signs with %s account's key and omits scheme", async (_, emptySignature) => {
    const address = algosdk.generateAccount().addr
    const wallet = createWallet([
      { name: 'A', address: address.toString(), ...(emptySignature && { emptySignature }) }
    ])

    const result = await wallet.createStdSignDataForTest('data')

    expect(result).toEqual({
      data: 'data',
      signer: address.publicKey,
      domain,
      authenticatorData: await sha256(domain)
    })
    expect(result).not.toHaveProperty('scheme')
    expect(accountInformation).toHaveBeenCalledWith(address.toString())
  })

  it("signs with a rekeyed ed25519 account's auth key and omits scheme", async () => {
    const address = algosdk.generateAccount().addr
    const authAddr = algosdk.generateAccount().addr
    mockAuthAddr(authAddr)
    const wallet = createWallet([
      {
        name: 'A',
        address: address.toString(),
        emptySignature: encodeEmptySignature({ sgnr: authAddr })
      }
    ])

    const result = await wallet.createStdSignDataForTest('data')

    expect(result.signer).toEqual(authAddr.publicKey)
    expect(result).not.toHaveProperty('scheme')
  })

  // Unchanged from before ARC-60 had schemes: only pqsig accounts get one
  it.each([
    [
      'multisig',
      { msig: { v: 1, thr: 1, subsig: [{ pk: algosdk.generateAccount().addr.publicKey }] } }
    ],
    ['logic sig', { lsig: new algosdk.LogicSig(new Uint8Array([0x06, 0x81, 0x01])) }]
  ])("signs with a %s account's address key and omits scheme", async (_, fields) => {
    const address = algosdk.generateAccount().addr
    const wallet = createWallet([
      { name: 'A', address: address.toString(), emptySignature: encodeEmptySignature(fields) }
    ])

    const result = await wallet.createStdSignDataForTest('data')

    expect(result.signer).toEqual(address.publicKey)
    expect(result).not.toHaveProperty('scheme')
  })

  it('signs with the Falcon public key and falcon-1024-det scheme', async () => {
    const falcon = makeFalconAccount()
    const { pqsig, emptySignature } = await getEmptySignature(falcon)
    const wallet = createWallet([
      { name: 'PQ', address: falcon.address.toString(), emptySignature }
    ])

    const result = await wallet.createStdSignDataForTest('data')

    expect(result).toEqual({
      data: 'data',
      signer: pqsig.pk,
      domain,
      authenticatorData: await sha256(domain),
      scheme: 'falcon-1024-det'
    })
    expect(result.signer).toHaveLength(1793)
  })

  it('signs with the Falcon key of an account rekeyed to it', async () => {
    const address = algosdk.generateAccount().addr
    const falcon = makeFalconAccount(address)
    const { pqsig, emptySignature } = await getEmptySignature(falcon)
    mockAuthAddr(algosdk.addressFromPQSig(pqsig))
    const wallet = createWallet([{ name: 'PQ', address: address.toString(), emptySignature }])

    const result = await wallet.createStdSignDataForTest('data')

    expect(result.signer).toEqual(pqsig.pk)
    expect(result.scheme).toBe('falcon-1024-det')
  })

  it('throws 4603 when the account was rekeyed away from its Falcon key', async () => {
    const falcon = makeFalconAccount()
    const { emptySignature } = await getEmptySignature(falcon)
    mockAuthAddr(algosdk.generateAccount().addr)
    const wallet = createWallet([
      { name: 'PQ', address: falcon.address.toString(), emptySignature }
    ])

    const result = wallet.createStdSignDataForTest('data')

    await expect(result).rejects.toThrow(SignDataError)
    await expect(result).rejects.toMatchObject({
      code: 4603,
      message: `Account ${falcon.address} is not authorized by its post-quantum key; reconnect the wallet`
    })
  })

  it('throws 4603 for a pqsig with a non-canonical salt', async () => {
    const falcon = makeFalconAccount()
    const { pqsig } = await getEmptySignature(falcon)
    const emptySignature = encodeEmptySignature({ pqsig: { ...pqsig, slt: pqsig.slt + 1 } })
    const wallet = createWallet([
      { name: 'PQ', address: falcon.address.toString(), emptySignature }
    ])

    await expect(wallet.createStdSignDataForTest('data')).rejects.toMatchObject({ code: 4603 })
  })

  it('throws 4601 for a post-quantum scheme ARC-60 does not name, without querying algod', async () => {
    const falcon512 = algosdk.addressWithSignersFromRawPQSigner({
      pqScheme: new TextEncoder().encode('f5'),
      pqPublicKey: crypto.getRandomValues(new Uint8Array(897)),
      pqSigner: async () => new Uint8Array(0)
    })
    const { emptySignature } = await getEmptySignature(falcon512)
    const wallet = createWallet([
      { name: 'PQ', address: falcon512.address.toString(), emptySignature }
    ])

    const result = wallet.createStdSignDataForTest('data')

    await expect(result).rejects.toThrow(SignDataError)
    await expect(result).rejects.toMatchObject({
      code: 4601,
      message: 'signData does not support this post-quantum signature scheme'
    })
    expect(accountInformation).not.toHaveBeenCalled()
  })
})

describe('applyEmptySignatures', () => {
  const a1 = { name: 'Account 1', address: 'ADDRESS1' }
  const a2 = { name: 'Account 2', address: 'ADDRESS2' }

  it("sets connected accounts' empty signatures and ignores unconnected addresses", () => {
    const { wallet, store } = createWalletWithStore([a1, a2])

    wallet.applyEmptySignaturesForTest({ ADDRESS1: 'gA==', ADDRESS2: 'sig2', OTHER: 'sig3' })

    expect(store.state.wallets['test']?.accounts).toEqual([
      { ...a1, emptySignature: 'gA==' },
      { ...a2, emptySignature: 'sig2' }
    ])
    expect(store.state.wallets['test']?.activeAccount).toEqual({ ...a1, emptySignature: 'gA==' })
  })

  it('clears the empty signature of accounts missing from the response', () => {
    const { wallet, store } = createWalletWithStore([
      { ...a1, emptySignature: 'gA==' },
      { ...a2, emptySignature: 'sig2' }
    ])

    wallet.applyEmptySignaturesForTest({ ADDRESS1: 'gA==', ADDRESS2: 123 })

    expect(store.state.wallets['test']?.accounts).toEqual([{ ...a1, emptySignature: 'gA==' }, a2])
  })

  it('keeps the recorded auth address of an unchanged empty signature', () => {
    const { wallet, store } = createWalletWithStore([{ ...a1, emptySignature: 'gA==' }, a2])
    recordEmptySignatureChecks(store, {
      walletId: 'test',
      checks: [{ address: 'ADDRESS1', emptySignature: 'gA==', authAddr: null }]
    })

    wallet.applyEmptySignaturesForTest({ ADDRESS1: 'gA==', ADDRESS2: 'sig2' })

    expect(store.state.wallets['test']?.accounts).toEqual([
      { ...a1, emptySignature: 'gA==', authAddr: null },
      { ...a2, emptySignature: 'sig2' }
    ])
  })

  it('ignores a response that is not a map', () => {
    const { wallet, store } = createWalletWithStore([{ ...a1, emptySignature: 'gA==' }])
    const before = store.state

    for (const response of [null, 'gA==', ['gA=='], undefined]) {
      wallet.applyEmptySignaturesForTest(response)
    }

    expect(store.state).toBe(before)
  })

  it('does nothing when nothing changed', () => {
    const { wallet, store } = createWalletWithStore([{ ...a1, emptySignature: 'gA==' }])
    const before = store.state

    wallet.applyEmptySignaturesForTest({ ADDRESS1: 'gA==' })

    expect(store.state).toBe(before)
  })
})
