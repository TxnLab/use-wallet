import algosdk from 'algosdk'
import { WalletId, type JsonRpcRequest, type WalletAccount, type WalletMap } from './wallets/types'
import { DeflyWallet } from './wallets/defly'
import { ExodusWallet } from './wallets/exodus'
import { KibisisWallet } from './wallets/kibisis'
import { KmdWallet } from './wallets/kmd'
import { LuteWallet } from './wallets/lute'
import { MnemonicWallet } from './wallets/mnemonic'
import { PeraWallet } from './wallets/pera'
import { WalletConnect } from './wallets/walletconnect'

export function createWalletMap(): WalletMap {
  return {
    [WalletId.DEFLY]: DeflyWallet,
    [WalletId.EXODUS]: ExodusWallet,
    [WalletId.KIBISIS]: KibisisWallet,
    [WalletId.KMD]: KmdWallet,
    [WalletId.LUTE]: LuteWallet,
    [WalletId.MNEMONIC]: MnemonicWallet,
    [WalletId.PERA]: PeraWallet,
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

export function isTransaction(
  item: algosdk.Transaction | algosdk.Transaction[] | Uint8Array | Uint8Array[]
): item is algosdk.Transaction | algosdk.Transaction[] {
  if (Array.isArray(item)) {
    return item.every(
      (elem) =>
        typeof elem === 'object' &&
        elem !== null &&
        'genesisID' in elem &&
        typeof elem.genesisID === 'string'
    )
  } else {
    return (
      typeof item === 'object' &&
      item !== null &&
      'genesisID' in item &&
      typeof item.genesisID === 'string'
    )
  }
}

export function isSignedTxnObject(
  item: algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction
): item is algosdk.EncodedSignedTransaction {
  return (item as algosdk.EncodedSignedTransaction).txn !== undefined
}

export function normalizeTxnGroup(
  txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][]
): Uint8Array[] {
  if (!txnGroup[0]) {
    throw new Error('Empty transaction group!')
  }

  const isTransactionType = isTransaction(txnGroup[0])

  // Handle `algosdk.Transaction[] | algosdk.Transaction[]` types
  if (isTransactionType) {
    const transactionGroup: algosdk.Transaction[] = Array.isArray(txnGroup[0])
      ? (txnGroup as algosdk.Transaction[][]).flatMap((txn) => txn)
      : (txnGroup as algosdk.Transaction[])

    return transactionGroup.map((txn) => {
      return algosdk.encodeUnsignedTransaction(txn)
    })
  }

  // Handle `Uint8Array[] | Uint8Array[][]` types
  else {
    const transactionGroup: Uint8Array[] = Array.isArray(txnGroup[0])
      ? (txnGroup as Uint8Array[][]).flatMap((txn) => txn)
      : (txnGroup as Uint8Array[])

    return transactionGroup
  }
}

export function shouldSignTxnObject(
  txnObject: any,
  addresses: string[],
  indexesToSign: number[] | undefined,
  idx: number
): boolean {
  const isIndexMatch = !indexesToSign || indexesToSign.includes(idx)
  const isSigned = isSignedTxnObject(txnObject)
  const canSign = !isSigned && addresses.includes(algosdk.encodeAddress(txnObject.snd))
  const shouldSign = isIndexMatch && canSign

  return shouldSign
}

export function mergeSignedTxnsWithGroup(
  signedTxns: Uint8Array[],
  txnGroup: Uint8Array[],
  signedIndexes: number[],
  returnGroup: boolean
): Uint8Array[] {
  return txnGroup.reduce<Uint8Array[]>((acc, txn, i) => {
    if (signedIndexes.includes(i)) {
      const signedByUser = signedTxns.shift()
      signedByUser && acc.push(signedByUser)
    } else if (returnGroup) {
      acc.push(txnGroup[i]!)
    }
    return acc
  }, [])
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

/**
 * Generates a UUID version 4 string. This function attempts to use the `crypto.randomUUID()` function from the Web
 * Crypto API if it is available, otherwise it uses a polyfill method.
 *
 * NOTE: `crypto.randomUUID()` is not available in non-secure contexts; only localhost and HTTPS.
 * @returns {string} a valid UUID version 4 string.
 * @see {@link https://stackoverflow.com/a/2117523}
 */
export function generateUuid(): string {
  if (window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (value) => {
    const valueAsNumber: number = parseInt(value)

    return (
      valueAsNumber ^
      (window.crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (valueAsNumber / 4)))
    ).toString(16)
  })
}
