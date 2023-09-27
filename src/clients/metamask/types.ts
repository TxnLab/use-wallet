import type _algosdk from 'algosdk'
import { PROVIDER_ID } from '../../constants'
import type { AlgodClientOptions, Network, Metadata } from '../../types'
export type WindowExtended = { algorand: AlgoSigner, ethereum: any } & Window & typeof globalThis

export type GenesisId = 'betanet-v1.0' | 'testnet-v1.0' | 'mainnet-v1.0' | string

export type EnableParams = {
  // specific genesis ID requested by the dApp
  genesisID?: GenesisId
  // specific genesis hash requested by the dApp
  genesisHash?: string
  // array of specific accounts requested by the dApp
  accounts?: string[]
}

export type EnableResponse = {
  // specific genesis ID shared by the user
  genesisID: GenesisId
  // specific genesis hash shared by the user
  genesisHash: string
  // array of specific accounts shared by the user
  accounts: string[]
}

export type AlgoSignerTransaction = {
  // Base64-encoded string of a transaction binary
  txn: string
  // array of addresses to sign with (defaults to the sender),
  // setting this to an empty array tells AlgoSigner
  // that this transaction is not meant to be signed
  signers?: string[]
  // Base64-encoded string of a signed transaction binary
  stxn?: string
  // address of a multisig wallet to sign with
  multisig?: string
  // used to specify which account is doing the signing when dealing with rekeyed accounts
  authAddr?: string
}

export type AlgoSigner = {
  enable: (params?: EnableParams) => Promise<EnableResponse>
  signTxns: (transactions: AlgoSignerTransaction[]) => Promise<string[]>
  encoding: {
    msgpackToBase64(transaction: Uint8Array): string
    byteArrayToString(transaction: Uint8Array): string
  }
}

export type MetamaskClientConstructor = {
  metadata: Metadata
  client: any
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  network: Network
}

export type InitParams = {
  algodOptions?: AlgodClientOptions
  algosdkStatic?: typeof _algosdk
  network?: Network
}
