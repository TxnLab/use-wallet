import algosdk from 'algosdk'
import { WalletId, type JsonRpcRequest, type WalletAccount, type WalletMap } from './wallets/types'
import { CustomWallet } from './wallets/custom'
import { DeflyWallet } from './wallets/defly'
import { ExodusWallet } from './wallets/exodus'
import { KibisisWallet } from './wallets/kibisis'
import { KmdWallet } from './wallets/kmd'
import { LuteWallet } from './wallets/lute'
import { MagicAuth } from './wallets/magic'
import { MnemonicWallet } from './wallets/mnemonic'
import { PeraWallet } from './wallets/pera'
import { PeraWallet as PeraWalletBeta } from './wallets/pera2'
import { WalletConnect } from './wallets/walletconnect'

export function createWalletMap(): WalletMap {
  return {
    [WalletId.CUSTOM]: CustomWallet,
    [WalletId.DEFLY]: DeflyWallet,
    [WalletId.EXODUS]: ExodusWallet,
    [WalletId.KIBISIS]: KibisisWallet,
    [WalletId.KMD]: KmdWallet,
    [WalletId.LUTE]: LuteWallet,
    [WalletId.MAGIC]: MagicAuth,
    [WalletId.MNEMONIC]: MnemonicWallet,
    [WalletId.PERA]: PeraWallet,
    [WalletId.PERA2]: PeraWalletBeta,
    [WalletId.WALLETCONNECT]: WalletConnect
  }
}

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

export function isSignedTxn(
  txnDecodeObj: algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction
): txnDecodeObj is algosdk.EncodedSignedTransaction {
  return (txnDecodeObj as algosdk.EncodedSignedTransaction).txn !== undefined
}

export function isTransactionArray(
  txnGroup: any
): txnGroup is algosdk.Transaction[] | algosdk.Transaction[][] {
  return (
    txnGroup[0] instanceof algosdk.Transaction ||
    (Array.isArray(txnGroup[0]) && txnGroup[0][0] instanceof algosdk.Transaction)
  )
}

export function flattenTxnGroup<T>(txnGroup: T[]): T extends (infer U)[] ? U[] : T[] {
  return Array.isArray(txnGroup[0]) ? ((txnGroup as any[]).flat() as any) : txnGroup
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

export function deepMerge(target: any, source: any): any {
  const isObject = (obj: any) => obj && typeof obj === 'object'

  if (!isObject(target) || !isObject(source)) {
    throw new Error('Target and source must be objects')
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key]
    const sourceValue = source[key]

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = targetValue.concat(sourceValue)
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = deepMerge(Object.assign({}, targetValue), sourceValue)
    } else {
      target[key] = sourceValue
    }
  })

  return target
}
