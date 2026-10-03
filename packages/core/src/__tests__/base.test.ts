import algosdk from 'algosdk'
import { encodeEmptySignature } from 'src/empty-signature'
import { recordEmptySignatureChecks } from 'src/store'
import { createMockAlgodClient, createTestHarness } from 'src/testing'
import { BaseWallet } from 'src/wallets/base'
import { SignDataError } from 'src/wallets/types'
import type { AdapterConstructorParams, WalletAccount } from 'src/wallets/types'

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

function makeFalconAccount() {
  return algosdk.addressWithSignersFromRawFalcon1024Signer({
    falcon1024PublicKey: crypto.getRandomValues(new Uint8Array(1793)),
    falcon1024Signer: async () => new Uint8Array(0)
  })
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
  it('throws for a post-quantum account', async () => {
    const falcon = makeFalconAccount()
    const [stxn] = await falcon.emptyTxnSigner([makeTxn(falcon.address)], [0])
    const { pqsig } = algosdk.decodeSignedTransaction(stxn)
    const wallet = createWallet([
      {
        name: 'PQ',
        address: falcon.address.toString(),
        emptySignature: encodeEmptySignature({ pqsig: pqsig! })
      }
    ])

    const result = wallet.createStdSignDataForTest('data')

    await expect(result).rejects.toThrow(SignDataError)
    await expect(result).rejects.toMatchObject({
      code: 4200,
      message: 'signData is not supported for post-quantum accounts'
    })
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
