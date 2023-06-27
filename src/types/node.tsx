import type algosdk from 'algosdk'

export type PublicNetwork = 'betanet' | 'testnet' | 'mainnet'

export type Network = PublicNetwork | string

export type Txn = {
  apaa: Uint8Array
  apas: number[]
  apid: number
  fee: number
  fv: number
  gen: string
  gh: Uint8Array
  grp: Uint8Array
  lv: number
  snd: Uint8Array
  type: string
}

export type ConfirmedTxn = {
  'confirmed-round': number
  'global-state-delta': Record<string, unknown>[]
  'pool-error': string
  txn: {
    sig: Uint8Array
    txn: Txn
  }
}

export type TxnType = 'pay' | 'keyreg' | 'acfg' | 'axfer' | 'afrz' | 'appl' | 'stpf'

export type DecodedTransaction = {
  amt: number
  fee: number
  fv: number
  gen: string
  gh: Uint8Array
  grp: Uint8Array
  lv: number
  note: Uint8Array
  rcv: Uint8Array
  snd: Uint8Array
  type: TxnType
}

export type DecodedSignedTransaction = {
  sig: Uint8Array
  txn: DecodedTransaction
}

export type AlgodClientOptions = ConstructorParameters<typeof algosdk.Algodv2>
