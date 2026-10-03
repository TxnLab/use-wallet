import algosdk from 'algosdk'
import { decodeEmptySignature, encodeEmptySignature, getSignatureType } from 'src/empty-signature'
import { byteArrayToBase64 } from 'src/utils'

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

/** A Falcon-1024 account, with algosdk's own empty signer for it */
function makeFalconAccount() {
  return algosdk.addressWithSignersFromRawFalcon1024Signer({
    falcon1024PublicKey: crypto.getRandomValues(new Uint8Array(1793)),
    falcon1024Signer: async () => new Uint8Array(0)
  })
}

describe('encodeEmptySignature', () => {
  it('encodes a single ed25519 key as an empty map', () => {
    expect(encodeEmptySignature({ sig: new Uint8Array(64) })).toBe('gA==')
    expect(encodeEmptySignature({})).toBe('gA==')
  })

  it('encodes the signature fields of algosdk empty-signed transactions', async () => {
    const falcon = makeFalconAccount()
    const [stxn] = await falcon.emptyTxnSigner([makeTxn(falcon.address)], [0])
    const { pqsig } = algosdk.decodeSignedTransaction(stxn)

    const fields = algosdk.msgpackRawDecodeAsMap(stxn) as Map<string, unknown>
    fields.delete('txn')

    expect(encodeEmptySignature({ pqsig: pqsig! })).toBe(
      byteArrayToBase64(algosdk.msgpackRawEncode(fields))
    )
  })
})

describe('decodeEmptySignature', () => {
  it('decodes an ed25519 empty signature to no fields', () => {
    expect(decodeEmptySignature('gA==')).toEqual({})
  })

  it('round-trips a pqsig', async () => {
    const falcon = makeFalconAccount()
    const [stxn] = await falcon.emptyTxnSigner([makeTxn(falcon.address)], [0])
    const { pqsig } = algosdk.decodeSignedTransaction(stxn)

    const decoded = decodeEmptySignature(encodeEmptySignature({ pqsig: pqsig! }))

    expect(decoded.pqsig).toEqual(pqsig)
    expect(algosdk.addressFromPQSig(decoded.pqsig!).equals(falcon.address)).toBe(true)
  })

  it('round-trips a delegated lsig', () => {
    const lsigAccount = new algosdk.LogicSigAccount(new Uint8Array([0x06, 0x81, 0x01]))
    lsigAccount.sign(algosdk.generateAccount().sk)

    const decoded = decodeEmptySignature(encodeEmptySignature({ lsig: lsigAccount.lsig }))

    expect(decoded.lsig?.logic).toEqual(lsigAccount.lsig.logic)
    expect(decoded.lsig?.sig).toEqual(lsigAccount.lsig.sig)
  })

  it('round-trips a multisig', () => {
    const msig = {
      version: 1,
      threshold: 2,
      addrs: [algosdk.generateAccount().addr, algosdk.generateAccount().addr]
    }
    const stxn = algosdk.decodeSignedTransaction(
      algosdk.createMultisigTransaction(makeTxn(algosdk.multisigAddress(msig)), msig)
    )

    const decoded = decodeEmptySignature(encodeEmptySignature({ msig: stxn.msig! }))

    expect(decoded.msig).toEqual(stxn.msig)
  })

  it('keeps sgnr', () => {
    const sgnr = algosdk.generateAccount().addr

    expect(decodeEmptySignature(encodeEmptySignature({ sgnr })).sgnr?.equals(sgnr)).toBe(true)
  })

  it('throws for a value that is not a msgpack map', () => {
    expect(() => decodeEmptySignature(byteArrayToBase64(algosdk.msgpackRawEncode(1)))).toThrow(
      'expected a msgpack map'
    )
  })

  it('throws for a signed transaction', async () => {
    const stxn = (
      await algosdk.makeEmptyTransactionSigner()(
        [makeTxn(algosdk.ALGORAND_ZERO_ADDRESS_STRING)],
        [0]
      )
    )[0]

    expect(() => decodeEmptySignature(byteArrayToBase64(stxn))).toThrow('unexpected fields txn')
  })

  it('throws for unknown fields', () => {
    const encoded = byteArrayToBase64(algosdk.msgpackRawEncode(new Map([['foo', 1]])))

    expect(() => decodeEmptySignature(encoded)).toThrow('unexpected fields foo')
  })

  it('throws for more than one signature field', () => {
    const encoded = byteArrayToBase64(
      algosdk.msgpackRawEncode(
        new Map<string, unknown>([
          ['sig', new Uint8Array(64).fill(1)],
          ['lsig', new Map([['l', new Uint8Array([0x06, 0x81, 0x01])]])]
        ])
      )
    )

    expect(() => decodeEmptySignature(encoded)).toThrow('more than one signature field')
  })
})

describe('getSignatureType', () => {
  it('returns the signature field each kind of account uses', async () => {
    const falcon = makeFalconAccount()
    const [stxn] = await falcon.emptyTxnSigner([makeTxn(falcon.address)], [0])
    const { pqsig } = algosdk.decodeSignedTransaction(stxn)
    const lsig = new algosdk.LogicSig(new Uint8Array([0x06, 0x81, 0x01]))
    const msig = { v: 1, thr: 1, subsig: [{ pk: algosdk.generateAccount().addr.publicKey }] }

    expect(getSignatureType('gA==')).toBe('sig')
    expect(getSignatureType(encodeEmptySignature({ pqsig: pqsig! }))).toBe('pqsig')
    expect(getSignatureType(encodeEmptySignature({ lsig }))).toBe('lsig')
    expect(getSignatureType(encodeEmptySignature({ msig }))).toBe('msig')
  })

  it('returns undefined for an unknown or invalid empty signature', () => {
    expect(getSignatureType(undefined)).toBeUndefined()
    expect(getSignatureType('AQ==')).toBeUndefined()
    expect(getSignatureType('not base64!')).toBeUndefined()
  })
})
