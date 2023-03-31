import { encodeNFDTransactionsArray, NFDTransactionsArray } from './encodeNFDTransactionsArray'

describe('encodeNFDTransactionsArray', () => {
  it('should encode each transaction in the array to a Uint8Array', () => {
    const testTransactionsArray: NFDTransactionsArray = [
      ['u', 'dGVzdF90cmFuc2FjdGlvbl91XzE='], // test_transaction_u_1
      ['s', 'dGVzdF90cmFuc2FjdGlvbl9zXzE='] // test_transaction_s_1
    ]

    const result = encodeNFDTransactionsArray(testTransactionsArray)

    expect(result).toHaveLength(testTransactionsArray.length)
    expect(result[0]).toBeInstanceOf(Uint8Array)
    expect(result[1]).toBeInstanceOf(Uint8Array)

    // Verify if the decoded values match the expected base64 strings
    expect(Buffer.from(result[0]).toString('base64')).toEqual(testTransactionsArray[0][1])
    expect(Buffer.from(result[1]).toString('base64')).toEqual(testTransactionsArray[1][1])
  })
})
