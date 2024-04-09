import { base64ToByteArray } from './encoding'

export type NFDTransactionsArray = ['u' | 's', string][]

export function encodeNFDTransactionsArray(transactionsArray: NFDTransactionsArray) {
  return transactionsArray.map(([_type, txn]) => {
    return base64ToByteArray(txn)
  })
}
