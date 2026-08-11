import algosdk from 'algosdk'
import type { JsonRpcRequest, WalletAccount } from './wallets/types'

export function compareAccounts(accounts: WalletAccount[], compareTo: WalletAccount[]): boolean {
  const addresses = new Set(accounts.map((account) => account.address))
  const compareAddresses = new Set(compareTo.map((account) => account.address))

  if (addresses.size !== compareAddresses.size) {
    return false
  }

  // Check if every address in addresses is also in compareAddresses
  for (const address of addresses) {
    if (!compareAddresses.has(address)) {
      return false
    }
  }

  return true
}

export function base64ToByteArray(blob: string): Uint8Array {
  return stringToByteArray(atob(blob))
}

export function byteArrayToBase64(array: Uint8Array): string {
  return btoa(byteArrayToString(array))
}

export function stringToByteArray(str: string): Uint8Array {
  const array = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i)
  }
  return array
}

export function byteArrayToString(array: Uint8Array): string {
  let result = ''
  for (let i = 0; i < array.length; i++) {
    result += String.fromCharCode(array[i])
  }
  return result
}

export function isSignedTxn(txnObj: any): boolean {
  if (!txnObj || typeof txnObj !== 'object') return false
  if (!('sig' in txnObj && 'txn' in txnObj)) return false

  // Verify sig is a Uint8Array
  if (!(txnObj.sig instanceof Uint8Array)) return false

  // Verify txn is an object
  const txn = txnObj.txn
  if (!txn || typeof txn !== 'object') return false

  // Check for common transaction properties
  const hasRequiredProps = 'type' in txn && 'snd' in txn

  return hasRequiredProps
}

export function isTransaction(item: any): item is algosdk.Transaction {
  return (
    item &&
    typeof item === 'object' &&
    'sender' in item &&
    (item.sender instanceof algosdk.Address || typeof item.sender === 'string')
  )
}

export function isTransactionArray(
  txnGroup: any
): txnGroup is algosdk.Transaction[] | algosdk.Transaction[][] {
  if (!Array.isArray(txnGroup) || txnGroup.length === 0) {
    return false
  }

  if (isTransaction(txnGroup[0])) {
    return true
  }

  if (Array.isArray(txnGroup[0]) && txnGroup[0].length > 0 && isTransaction(txnGroup[0][0])) {
    return true
  }

  return false
}

export function flattenTxnGroup<T>(txnGroup: T[]): T[] {
  if (!Array.isArray(txnGroup[0])) {
    return txnGroup
  }
  return (txnGroup as unknown as any[]).flat()
}

function getPayloadId(): number {
  const date = Date.now() * Math.pow(10, 3)
  const extra = Math.floor(Math.random() * Math.pow(10, 3))
  return date + extra
}

export function formatJsonRpcRequest<T = any>(method: string, params: T): JsonRpcRequest<T> {
  return {
    id: getPayloadId(),
    jsonrpc: '2.0',
    method,
    params
  }
}
