import type algosdk from 'algosdk'
import type { Metadata, Network } from '../../types'

export interface Arc0001SignTxns {
  authAddr?: string
  multisig?: string
  signers?: string[]
  stxn?: string
  txn: string
}

export interface Arc0027Account {
  address: string
  name?: string
}

export interface KibisisClientConstructor {
  metadata: Metadata
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  genesisHash: string
  methods: ProviderMethods[]
  network: Network
}

export interface NetworkConfiguration {
  genesisHash: string
  genesisId: string
  methods: ProviderMethods[]
}

export type ProviderMethods =
  | 'enable'
  | 'getProviders'
  | 'postTxns'
  | 'signAndPostTxns'
  | 'signBytes'
  | 'signTxns'

export interface SendRequestWithTimeoutOptions<Params> {
  method: ProviderMethods
  params: Params
  reference: string
  timeout?: number
}

/**
 * message schema
 */

export interface RequestMessage<Params> {
  id: string
  params: Params
  reference: string
}

export interface ResponseMessage<Result = undefined, ErrorData = undefined> {
  error?: ResponseError<ErrorData>
  id: string
  reference: string
  requestId: string
  result?: Result
}

export interface ResponseError<Data = undefined> {
  code: number
  data: Data
  message: string
  providerId: string
}

/**
 * message payloads
 */

export interface EnableParams {
  genesisHash: string
  providerId: string
}

export interface EnableResult {
  accounts: Arc0027Account[]
  genesisHash: string
  genesisId: string
  providerId: string
  sessionId?: string
}

export interface GetProvidersParams {
  providerId: string
}

export interface GetProvidersResult {
  host: string
  icon: string
  name: string
  networks: NetworkConfiguration[]
  providerId: string
}

export interface SignTxnsParams {
  providerId: string
  txns: Arc0001SignTxns[]
}

export interface SignTxnsResult {
  providerId: string
  stxns: (string | null)[]
}
