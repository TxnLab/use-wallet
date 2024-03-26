import algosdk from 'algosdk'
import { addWallet, type State } from 'src/store'
import {
  generateUuid,
  isSignedTxnObject,
  mergeSignedTxnsWithGroup,
  normalizeTxnGroup,
  shouldSignTxnObject
} from 'src/utils'
import { BaseWallet } from './base'
import { WalletId, type WalletAccount, type WalletConstructor } from './types'
import type { Store } from '@tanstack/store'

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

export interface NetworkConfiguration {
  genesisHash: string
  genesisId: string
  methods: ProviderMethod[]
}

export type ProviderMethod =
  | 'enable'
  | 'getProviders'
  | 'postTxns'
  | 'signAndPostTxns'
  | 'signBytes'
  | 'signTxns'

export interface SendRequestWithTimeoutOptions<Params> {
  method: ProviderMethod
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

/**
 * arc-0027
 */
export const ARC_0027_PREFIX = 'arc0027'
export const ARC_0027_CHANNEL_NAME = `${ARC_0027_PREFIX}:channel`
export const ARC_0027_ENABLE_REQUEST = `${ARC_0027_PREFIX}:enable:request`
export const ARC_0027_GET_PROVIDERS_REQUEST = `${ARC_0027_PREFIX}:get_providers:request`
export const ARC_0027_PROVIDER_ID = 'f6d1c86b-4493-42fb-b88d-a62407b4cdf6'
export const ARC_0027_SIGN_TXNS_REQUEST = `${ARC_0027_PREFIX}:sign_txns:request`

/**
 * errors
 */
export const UNKNOWN_ERROR = 4000
export const METHOD_CANCELED_ERROR = 4001
export const METHOD_TIMED_OUT_ERROR = 4002
export const METHOD_NOT_SUPPORTED_ERROR = 4003
export const NETWORK_NOT_SUPPORTED_ERROR = 4004
export const UNAUTHORIZED_SIGNER_ERROR = 4100
export const INVALID_INPUT_ERROR = 4200
export const INVALID_GROUP_ID_ERROR = 4201

/**
 * genesis hashes
 */
export const ALGORAND_BETANET_GENESIS_HASH = 'mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0='
export const ALGORAND_MAINNET_GENESIS_HASH = 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
export const ALGORAND_TESTNET_GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
export const VOI_TESTNET_GENESIS_HASH = 'IXnoWtviVVJW5LGivNFc0Dq14V3kqaXuK2u5OQrdVZo='

/**
 * timeouts
 */
export const DEFAULT_REQUEST_TIMEOUT = 180000 // 3 minutes in milliseconds
export const LOWER_REQUEST_TIMEOUT = 750 // 0.75 seconds in milliseconds
export const UPPER_REQUEST_TIMEOUT = 300000 // 5 minutes in milliseconds

const icon =
  'data:image/svg+xml;base64,' +
  'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgdmVyc2lvbj0iMS4xIgogICBpZD0ic3ZnMiIKICAgdmlld0JveD0iMCAwIDEzNjUuMzMzMyAxMzY1LjMzMzMiCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGgKICAgIGQ9Im0gNjY3Ljk5OTk4LDEwNDguNjY2MiBjIDAsLTY0LjE2Njk4IC0wLjYyMDQ0LC0xMjguODE2OTggLTEuMzc4NzcsLTE0My42NjY3IC0yLjgxMTA3LC01NS4wNDczNyAtMTIuMDY3NDksLTkzLjA1MjU5IC0zMy4yNDA1OSwtMTM2LjQ3OTkyIC0yMS41MDczNCwtNDQuMTEyODkgLTUxLjA3MDU3LC04Mi42MzAyMiAtODQuNzM2ODYsLTExMC40MDE5OCAtMjMuNjQ4MjEsLTE5LjUwNzcxIC0yOS4zOTQ4NCwtMjMuNTc5NjMgLTUzLjU5NzA3LC0zNy45Nzc1NSAtMTAuMzU1NTMsLTYuMTYwNDkgLTQ1Ljk3MTAyLC0yMi44MDY3MyAtNDguNzk2MjIsLTIyLjgwNjczIC0wLjk0NDQzLDAgLTIuMjg3MTUsLTAuNTUyODkgLTIuOTgzODEsLTEuMjI4NjUgLTEuNDkxOTUsLTEuNDQ3MTYgLTM0LjAwNzg3LC0xMS4wNzg0NyAtNDQuNiwtMTMuMjEwNjQgLTE5LjUwOTI4LC0zLjkyNzE4IC00Ni4xMDEzMSwtNi44NjQxMiAtNjUuOTI5MTUsLTcuMjgxNTIgbCAtMTMuMjYyNDksLTAuMjc5MTkgLTEuNzk0NCwxMi42NjY2NyBjIC0yLjQ3MjMzLDE3LjQ1MjI1IC0yLjk5NDMyLDQ4LjMxNTQzIC0zLjAwNDg3LDE3Ny42NjY2NiBsIC0wLjAwOSwxMTEuNjY2NjYgaCAtMjggLTI4IGwgMC4wMjg5LC0xMzAuMzMzMzMgYyAwLjAyNjQsLTExOC45MzM1NyAwLjI1Mjg0LC0xMzIuNDkwODIgMi41ODg1NiwtMTU0Ljk5OTk5IDIuNjU1MjMsLTI1LjU4ODI2IDYuMzY3NjgsLTQ4LjY4Njg2IDkuODU3NTksLTYxLjMzMzM0IDcuMDU0NTIsLTI1LjU2MzU4IDEwLjYyNTc5LC0zNy4yNjIyMSAxMi44MjE0MywtNDIgMC42Nzk3LC0xLjQ2NjY2IDIuMTI2MzMsLTUuMzY2NjYgMy4yMTQ3MywtOC42NjY2NiA2LjY5Njc2LC0yMC4zMDQ0NyAyNi40NDAxNSwtNTguNzgxMzYgNDMuNDg4NzMsLTg0Ljc1MzAzIDI4LjA3NzM3LC00Mi43NzI4MSA2MC4zNDY2OSwtNzYuODgwNzQgMTA0LjY2NjY3LC0xMTAuNjMwMjYgNC42ODc3NywtMy41Njk3MiAyOS40ODMwNSwtMjAuMDcxOTkgMzkuNjU5OTgsLTI2LjM5NTMyIDEzLjU2MjQxLC04LjQyNjg5IDUxLjgwNDgsLTI2LjY4OTI1IDY1LjAwNjY4LC0zMS4wNDM0NSAzLjMsLTEuMDg4NCA3LjIsLTIuNTMxMiA4LjY2NjY3LC0zLjIwNjIzIDcuNjYxMzMsLTMuNTI2MDkgNDEuMjA5ODgsLTEzLjE5MDY5IDU2LC0xNi4xMzIzNyA3OS45NTg3OCwtMTUuOTAzMzkgMTU3Ljk3ODkyLC0xMC43Njc3MSAyMzMuOTk5OTksMTUuNDAzMDYgNDEuOTE4NjEsMTQuNDMwNzYgNzUuOTk2NDksMzIuMTc3NzkgMTE0Ljc1MTY2LDU5Ljc2MDE5IDE2Ljg4MDQ3LDEyLjAxMzk5IDQ3LjIyMTc2LDM4Ljk4MjMxIDU5LjkxMTE2LDUzLjI1MTAzIDUuNDE5Myw2LjA5MzgzIDExLjUxMDgsMTIuNzc1MDMgMTMuNTM2NSwxNC44NDcxIDMuNTYzNiwzLjY0NTA5IDI0LjIyOTQsMzAuNTQ2NDkgMjkuODI3OCwzOC44Mjc4NyAyNC4xNjc3LDM1Ljc0OTczIDQ1LjkxMjYsODEuODc4OTQgNTcuMjI5MSwxMjEuNDA0NzQgMS4yNTk4LDQuNCAyLjgxMjQsOS41IDMuNDUwNCwxMS4zMzMzMyAxLjYxNDgsNC42NDA3OCA2LjUzMDksMjguMjM1NiA4LjA1NjMsMzguNjY2NjcgMC42OTcxLDQuNzY2NjcgMS41ODAzLDkuNTE2OTUgMS45NjI2LDEwLjU1NjE2IDAuMzgyNCwxLjAzOTIzIDEuNTcxNiwxMy4wMzkyMyAyLjY0MjcsMjYuNjY2NjcgMS41MTk3LDE5LjMzNDgzIDEuOTQ5NSw1Mi42NzI4MyAxLjk1NjMsMTUxLjc3NzE3IGwgMC4wMSwxMjYuOTk5OTkgaCAtMjcuOTA3NSAtMjcuOTA3NiBsIC0wLjYzOTIsLTEzOS42NjY2NiBjIC0wLjUwMTYsLTEwOS41Nzg2MyAtMS4wMzM5LC0xNDIuMTA4MTcgLTIuNDcxMSwtMTUxIGwgLTEuODMxOCwtMTEuMzMzMzMgLTEyLjYyMTQsMC4yMzMwNCBjIC00MS4xOTI1LDAuNzYwNTcgLTgwLjc3OTcyLDguNTI0MjEgLTExOC45NjgzMywyMy4zMzE0NyBsIC0xNC4zNDY4Nyw1LjU2Mjg2IDEuMDEzNTQsOC43Njk2NCBjIDAuNTU3NDQsNC44MjMzMSAxLjAxMzUzLDk4Ljc2OTY1IDEuMDEzNTMsMjA4Ljc2OTY1IFYgMTAyMiBsIC0yNy42NjY2NywwLjM2MDQgLTI3LjY2NjY2LDAuMzYwMyBWIDgyOS4yMTc3MSBjIDAsLTE2NC45MjU5MSAtMC4yNzQ1MiwtMTkzLjM5NzY5IC0xLjg1ODg4LC0xOTIuNzg5NzEgLTguMjY2MjcsMy4xNzIwNiAtNDMuNTg1MTcsMzQuMTczMzIgLTU5LjI2MDMyLDUyLjAxNTg5IC0zNy4wMDU5Niw0Mi4xMjI4MyAtNjMuMjI1MSw5MC40MjEzIC03Ni4xOTQ0NSwxNDAuMzU4NDEgLTExLjMzNTMxLDQzLjY0NTM2IC0xMi4wODU5Miw1Ny45ODA0NCAtMTEuMDc1NDMsMjExLjUxNzMgbCAwLjgyMjc4LDEyNS4wMTM3IGggLTI4LjIxNjg2IC0yOC4yMTY4NCB6IG0gNDAuMTQ2OTYsLTMwNy4xMTM4IGMgMTYuMjcwNDgsLTM0LjI1NTk4IDM1LjE1MzYyLC02Mi4xNDM5IDYxLjk1NjQxLC05MS41MDE1OCAxMy40MDA5NiwtMTQuNjc4MzMgMzUuMTE3NTUsLTM1LjE5MzkgNDUuMjI5OTYsLTQyLjcyODUzIDIuOTMzMzQsLTIuMTg1NTggNS42MzMzNCwtNC4zMzE0IDYsLTQuNzY4NDYgMS4yMzM5NSwtMS40NzA4NyAyNC44ODc1OCwtMTguMjUzMzEgMjguNzk2MzYsLTIwLjQzMTI2IDIuMTI4NjcsLTEuMTg2MDggNC43NzAzMSwtMi43MzE3OCA1Ljg3MDMxLC0zLjQzNDg5IDEyLjk1MTY5LC04LjI3ODY4IDM0LjU3NzI4LC0xOS41MDUyMyA1Ni42NjY2NiwtMjkuNDE3NTIgMTAuODEzOTksLTQuODUyNjMgMzYuNDY4MjMsLTEzLjQ5NzE2IDUxLjMzMzM0LC0xNy4yOTc0NSAyNy40NzU5LC03LjAyNDI3IDQ4LjI1OTMyLC0xMC4yNDc0NiA3My44ODM0MiwtMTEuNDU4MiAxMC42OTc0LC0wLjUwNTQ2IDE5LjQ0OTksLTEuMzI4OTEgMTkuNDQ5OSwtMS44Mjk5IDAsLTYuNDQ4NzYgLTE4LjI2MTEsLTQ4LjI1NTY2IC0zMC43MTgsLTcwLjMyNTYzIC04LjAxMjIsLTE0LjE5NTQ0IC0yMi40MzU4LC0zNi41MTA0OCAtMjUuMjI0NiwtMzkuMDI1NjYgLTAuNDA2NiwtMC4zNjY2NiAtMi40OTYxMiwtMy4wNjY2NiAtNC42NDM0MywtNiAtMTkuNzAwOTEsLTI2LjkxMjM4IC01NS4wMzY2OSwtNjAuMzg0NDkgLTg2Ljc0NzI5LC04Mi4xNzIwNiAtNTkuNzQyMzksLTQxLjA0NzU1IC0xMzAuNzM1NzYsLTYzLjgxMDUxIC0yMDYuMjMzOTIsLTY2LjEyNTgzIC00Ny42MDY0OCwtMS40NTk5NiAtMTAwLjIwMDE5LDguMDk0NzUgLTE0OS43NjYwNywyNy4yMDgwNCAtMjUuOTQ2OTksMTAuMDA1NTEgLTY5LjMxNzMxLDM0LjU2MDI2IC05MCw1MC45NTQ4MiAtNDkuNTM0MTEsMzkuMjY0MjIgLTgyLjY1Njg4LDc5LjkwNjkzIC0xMTAuNDA0OCwxMzUuNDcwMjYgLTcuMzMwNDcsMTQuNjc4NzQgLTIwLjI2MTg2LDQ1Ljk1MjM3IC0yMC4yNjE4Niw0OS4wMDE4IDAsMS41NTMwNiAzLjcyMDk2LDIuMTE2NjEgMTguOTUzNzcsMi44NzA1OCAxNy41MzYzOCwwLjg2OCA0NS40MjI4NSw0LjA0Mzc0IDQ3LjY2MjM3LDUuNDI3ODMgMC41MjkzMywwLjMyNzE1IDQuMjA3MjQsMS4xNDE1MiA4LjE3MzEzLDEuODA5NzIgMTQuOTMwODQsMi41MTU2NSA1NS45NDQ3MSwxNC44NjkwOCA2NS40Nzc4NCwxOS43MjIgMS45ODAyNiwxLjAwODA3IDQuMTM1NDYsMS44MzI4NCA0Ljc4OTM1LDEuODMyODQgMC42NTM4OSwwIDIuNzc5NDUsLTQuMDUgNC43MjM0NSwtOSAzLjQzMjkxLC04Ljc0MTE3IDE1Ljc1MDI3LC0zMC41ODg5MyAyMS40MTg4NCwtMzcuOTkxNCAxNi4xODI5MSwtMjEuMTMyOTEgMjQuNTgwMDksLTMwLjI1OTM4IDM5LjQ2NzkxLC00Mi44OTU3MiAxNS4yMDUxNywtMTIuOTA1NjkgMjEuMTgwMjksLTE3LjAxOTI4IDM5LjU3MTg0LC0yNy4yNDMzNCAzOC4wNTIxNSwtMjEuMTUzNjMgODYuNzgzNjEsLTMxLjc5NzQ0IDEyOS4yMjUxMSwtMjguMjI1MDcgMzMuMjQ3NTksMi43OTg0OSA1NS4wODQ4Nyw4LjYxODU1IDgyLjUzNjM3LDIxLjk5NzUzIDM2LjA4NzA0LDE3LjU4NzY2IDYzLjQ4NTY0LDQwLjYyMzEgODguNzc4NzEsNzQuNjQwOTYgOC43OTcwOCwxMS44MzE2MSA4Ljc3NDY2LDEyLjA3NyAtMS40NDUzNywxNS44MjIyOCAtMy4zLDEuMjA5MzMgLTEzLjQ2Mzg3LDYuMzQyODUgLTIyLjU4NjM4LDExLjQwNzgzIC05LjEyMjUsNS4wNjQ5NyAtMTcuMzQ0MTcsOC45MTgyNCAtMTguMjcwMzcsOC41NjI4MiAtMC45MjYyLC0wLjM1NTQxIC0zLjQ4MzY3LC0zLjQ1MDczIC01LjY4MzI1LC02Ljg3ODQ5IC01LjcyMjE1LC04LjkxNzIgLTI5LjcxMjY3LC0zMS45NDA4NSAtNDEuNDYsLTM5Ljc4OTA4IC0zNS4xNTk2NywtMjMuNDg5NjYgLTc0LjE0MzY3LC0zMy4zODg4OCAtMTE2Ljk5NzM2LC0yOS43MDkxNCAtNTkuMDAwNDcsNS4wNjYyMiAtMTE0Ljc3MzQ4LDQ0LjUxMzk1IC0xNDEuNzIwOTQsMTAwLjIzNzg5IC0yLjkwNDk0LDYuMDA3MDIgLTUuMjgxNywxMS45OTE0MSAtNS4yODE3LDEzLjI5ODY0IDAsMS40MjQ2NiAyLjEwNTM0LDMuNDUwODIgNS4yNTU2Nyw1LjA1OCAxNC45NTUwMSw3LjYyOTQ4IDQ2LjQ3OTc1LDMzLjAzNjg0IDY5LjQ4NTQ5LDU2LjAwMTg1IDI3LjcxMDExLDI3LjY2MTAyIDQ1Ljc4OTkzLDUwLjkwNTk4IDY1LjI2NjE1LDgzLjkxMTY1IDguNjE2OTYsMTQuNjAyODcgMTIuNDU5NzQsMjIuNDUxMTMgMjIuMTIxMDYsNDUuMTc4NjggbCAyLjQzMTIsNS43MTkyMiAyLjU1NDMyLC01LjcxOTIyIGMgMS40MDQ4OCwtMy4xNDU1OCA2LjA2OTc2LC0xMy4xMjA2NCAxMC4zNjY0LC0yMi4xNjY4MSB6IG0gLTI0NS40ODAyOCw5Ni42Njk4MSBjIDAsLTEwMS40NDQ0NSAwLjM1MDAxLC0xODQuNzk0NDUgMC43Nzc4LC0xODUuMjIyMjQgMS45NjYwNCwtMS45NjYwNSAyMS4zMTA0MSw5LjU3ODU5IDQxLjIyMjE5LDI0LjYwMTI1IGwgMTQuNjY2NjcsMTEuMDY1NDMgMC4zMzg1MSwxNjcgMC4zMzg0OSwxNjYuOTk5OTUgaCAtMjguNjcxODMgLTI4LjY3MTgzIHoiCiAgICBmaWxsPSIjZmZmZmZmIiAvPgogIDxwYXRoCiAgICBkPSJNIDAsNjgyLjY2NjY1IFYgMCBIIDY4Mi42NjY2NSAxMzY1LjMzMzMgViA2ODIuNjY2NjUgMTM2NS4zMzMzIEggNjgyLjY2NjY1IDAgWiBNIDcyNC4zMTE4NiwxMDI1IGMgMC4zNTI2OCwtMTI3LjE2NjgyIDAuNjI1NTYsLTE0Mi44MjY2NyAyLjY2NjE0LC0xNTMuMDAwMDIgMS4yNTAyOSwtNi4yMzMzMyAzLjI0NjY1LC0xNy4wMzMzMyA0LjQzNjM0LC0yNCAyLjE2OTM0LC0xMi43MDMxMyA1LjkyODM5LC0yNy4yNzg3MiA5LjI4NDQ0LC0zNiAwLjk4NzcsLTIuNTY2NjcgMi41Mjc0NCwtNy4wNjY2NyAzLjQyMTY3LC0xMCAwLjg5NDIzLC0yLjkzMzMzIDMuNjMyOTUsLTkuNjg1ODcgNi4wODYwNCwtMTUuMDA1NjQgMi40NTMwOSwtNS4zMTk3NiA0LjQ2MDE2LC0xMC4wNzIzNSA0LjQ2MDE2LC0xMC41NjEyOSAwLC0wLjc5MDE1IDYuMDI2NDQsLTEzLjI1NjM1IDkuMzk0MzgsLTE5LjQzMzA3IDAuNjk5NzUsLTEuMjgzMzMgMS44NDY1OCwtMy4zODMzMyAyLjU0ODUsLTQuNjY2NjcgMy4xOTMwNCwtNS44Mzc5MyAxNC4wMDg2NCwtMjMuNzM0ODkgMTQuNzA1MjUsLTI0LjMzMzMzIDAuNDI2ODMsLTAuMzY2NjYgMy43NDE1OSwtNC44NjY2NiA3LjM2NjE1LC0xMCAzLjYyNDU0LC01LjEzMzMzIDcuNTg0ODgsLTEwLjUzMzMzIDguODAwNzIsLTEyIDE5LjI5NjI0LC0yMy4yNzcwMSAzNi4xMTI4OSwtNDAuNTI5ODQgNDguNzcyNTMsLTUwLjAzNzU4IDQuMjYwMTksLTMuMTk5NTIgOC4zNDU4LC02LjQ2MzQ0IDkuMDc5MTMsLTcuMjUzMTYgMC43MzMzNCwtMC43ODk3MSA0LjQ4MzM0LC0zLjcyMzQ2IDguMzMzMzQsLTYuNTE5NDQgbCA3LC01LjA4MzYgdiAxOTIuNzgwMjIgMTkyLjc4MDE4IGggMjkuMzY5NzQgMjkuMzY5NzYgbCAtMC41MDA1NywtMjA1LjY2NjYyIGMgLTAuMjc1MzIsLTExMy4xMTY2NiAtMC43NDE3MSwtMjA3LjA0ODc4IC0xLjAzNjQzLC0yMDguNzM4MDMgLTAuNDU0OTcsLTIuNjA3ODIgMC40NzAzMywtMy40ODc2MiA2LjEzMDgzLC01LjgyOTM1IDMuNjY2NjYsLTEuNTE2ODggOC41NTczNCwtMy41ODQ3NiAxMC44NjgxNywtNC41OTUyOSAyLjMxMDgzLC0xLjAxMDUyIDUuMTg0NzMsLTEuODM3MzIgNi4zODY0NSwtMS44MzczMiAxLjIwMTcyLDAgNC40MTEwNCwtMS4wOTQ5MSA3LjEzMTgzLC0yLjQzMzEyIDEzLjk1ODk2LC02Ljg2NTY4IDYxLjc1MzQ3LC0xNS42NTIxMSA5MS43NDg2NywtMTYuODY2ODQgbCAyMC4xMzUyLC0wLjgxNTQyIDAuODY3OCw4LjM5MTAyIGMgMC40Nzc0LDQuNjE1MDYgMS40NDY5LDEyLjU5MTAyIDIuMTU0NiwxNy43MjQzNiAwLjc1MTcsNS40NTI4MiAxLjMxMzMsNjQuNDkxODYgMS4zNTA3LDE0MS45OTk5OSAwLjAzNSw3Mi45NjY2NyAwLjU0OCwxMzMuNDI5MTYgMS4xMzk1LDEzNC4zNjExMSAwLjgyNjEsMS4zMDE1IDcuNTQ2NCwxLjYxMDcgMjguOTc5NiwxLjMzMzMzIGwgMjcuOTA0MSwtMC4zNjExMSAtMC4wOTcsLTEzNi42NjY2NiBjIC0wLjA5NCwtMTMyLjc3MDI1IC0wLjE4MTYsLTEzNy4zNTA5MiAtMy4wNTcyLC0xNjAuNjY2NjYgLTMuMTk4MiwtMjUuOTMxNjQgLTUuMzM2NSwtMzcuMzUwNjYgLTEwLjQ4NjQsLTU2IC0xLjgyMjUsLTYuNiAtMy40Mzk5LC0xMi42IC0zLjU5NCwtMTMuMzMzMzQgLTEuNTgsLTcuNTE1NzcgLTMuMDk5NiwtMTIuMjk4MyAtNi45Mzc0LC0yMS44MzQyNCAtMi40NzE5LC02LjE0MjE2IC00LjQ5NDQsLTExLjk5MDQ0IC00LjQ5NDQsLTEyLjk5NjE3IDAsLTMuMTI2NDEgLTIzLjUxMTEsLTUyLjEwOTQ0IC0yOC42NDgzLC01OS42ODU2OSAtMS41NDc4LC0yLjI4MjgxIC0zLjIwNzcsLTUuMTc3OTEgLTMuNjg4NSwtNi40MzM1NiAtMS43ODIxLC00LjY1MzggLTI2LjM0MTksLTQwLjUxNTIgLTMyLjMyOTksLTQ3LjIwNzA1IC0wLjczMzMsLTAuODE5NTQgLTQuMzMzMywtNS4yNDMxMiAtOCwtOS44MzAyIC04LjYxMTEsLTEwLjc3Mjc0IC00MS41MTU1OSwtNDQuMDgwNjQgLTUyLjU1NzYsLTUzLjIwMjAzIC00LjcwNjY4LC0zLjg4ODAyIC05LjM4ODc1LC03LjkwMDI4IC0xMC40MDQ2LC04LjkxNjEzIC0xLjg4MTk2LC0xLjg4MTk1IC01Ljk1NzMsLTQuNzQzIC0yOC4zNzExMiwtMTkuOTE3NzIgLTYuOTY2NjcsLTQuNzE2NiAtMTMuMzI4NTYsLTkuMTMyMzUgLTE0LjEzNzU1LC05LjgxMjc3IC0wLjgwODk5LC0wLjY4MDQyIC01LjMwODk5LC0zLjIxMzQzIC0xMCwtNS42Mjg5MiAtNC42OTEwMSwtMi40MTU1IC04LjgyOTEyLC00Ljc2NDU0IC05LjE5NTc5LC01LjIyMDA4IC0yLjI5NTY4LC0yLjg1MjIyIC01MC41MTMyMywtMjQuNTUwMTYgLTYzLjk5OTk5LC0yOC44MDAwNyAtMjQuNTAxMTQsLTcuNzIwNzMgLTM2LjQxNDI0LC0xMS4xODA0NyAtNDMuMzMzMzQsLTEyLjU4NDY1IC00LjQsLTAuODkyOTUgLTExLjksLTIuNjgwNiAtMTYuNjY2NjYsLTMuOTcyNTYgLTM5LjkyMDQ1LC0xMC44MjAwNyAtMTM4LjY2NjM5LC0xMC41MTUyIC0xNzkuMzMzMzMsMC41NTM2OSAtMy42NjY2NywwLjk5OCAtMTEuNDY2NjcsMi44NTc3MSAtMTcuMzMzMzMsNC4xMzI2NyAtNS44NjY2NywxLjI3NDk2IC0xNi40MzYyNCw0LjM1MTUyIC0yMy40ODc5NCw2LjgzNjggLTcuMDUxNywyLjQ4NTI4IC0xMy41NjEwMiw0LjUxODY5IC0xNC40NjUxNyw0LjUxODY5IC0wLjkwNDEzLDAgLTMuNTM0NTYsMC44NTY2NCAtNS44NDUzOSwxLjkwMzY0IC0xMC41NTQyMSw0Ljc4MTk1IC0xNi43ODI1Miw3LjQyOTY5IC0xNy40NzY4Niw3LjQyOTY5IC0yLjIyNzY4LDAgLTUzLjM0ODIsMjYuMTM1NiAtNTYuODIxOTUsMjkuMDUwNDggLTEuMDQ2NDgsMC44NzgxMiAtOC4yMDI2OSw1Ljc5Nzk2IC0xNS45MDI2OSwxMC45MzI5OCAtMjkuMzA3NjcsMTkuNTQ0ODEgLTQxLjg1MDI3LDI5Ljc5OTIyIC02Ni4wMjkyOCw1My45ODMzMyAtMTguNjM4MDEsMTguNjQxOTQgLTI4LjQ0MTg0LDI5Ljk0Mjg0IC00MS41NTE5OSw0Ny44OTcwNiAtMy44MDMwMiw1LjIwODIyIC04LjY3MTAyLDExLjg2OTQ4IC0xMC44MTc3OCwxNC44MDI4MiAtMi4xNDY3NiwyLjkzMzMzIC01LjYxNDkzLDguMzMzMzMgLTcuNzA3MDUsMTIgLTIuMDkyMTIsMy42NjY2NiAtNC42MTEzMSw3LjQ5NjczIC01LjU5ODIyLDguNTExMjQgLTAuOTg2ODksMS4wMTQ1MiAtMy4xNzM1OCw0LjYxNDUyIC00Ljg1OTMsOCAtMS42ODU3MiwzLjM4NTQ5IC02LjQ3NDEsMTIuNzU1NDIgLTEwLjY0MDgzLDIwLjgyMjA5IC00LjE2NjczLDguMDY2NjcgLTkuOTkwODMsMjAuMzY2NjcgLTEyLjk0MjQxLDI3LjMzMzMzIC0yLjk1MTYsNi45NjY2NyAtNi4yMjYwMywxNC41NTczNSAtNy4yNzY1MSwxNi44NjgxNyAtMS4wNTA0OCwyLjMxMDgzIC0xLjkyNjczLDUuMDEwODMgLTEuOTQ3MjMsNiAtMC4wMjA1LDAuOTg5MTggLTEuODQ5MDUsNi44OTg1IC00LjA2MzQ4LDEzLjEzMTgzIC0zLjY5MzIyLDEwLjM5NjAzIC01LjI5MTE3LDE2LjMwMDQ4IC0xMS4xODYyNCw0MS4zMzMzMyAtOC4zNDY4MSwzNS40NDM5OCAtOS4yNDY3OCw1Ni42MDI1IC04LjgxODg4LDIwNy4zMzMzMyAwLjE5OTg2LDcwLjQgMC42NDA4NCwxMjguNDUgMC45Nzk5OCwxMjkgMC43OTY2NCwxLjI5MTk5IDUyLjY0MjM4LDEuMjcyNjEgNTQuNjM2OTcsLTAuMDIwNCAxLjEwMTQ4LC0wLjcxNDA3IDEuNzIyMTEsLTM4LjM4NTk2IDIuMjg5NTksLTEzOC45Nzk1OCAwLjY5MDIsLTEyMi4zNDM2NiAxLjYzMDg1LC0xNjEuMjA5MjkgMy45NTgwMSwtMTYzLjUzNjQ3IDEuMjcwMzMsLTEuMjcwMzIgNDguMTg1MTYsMi4wMTgxNCA1OC45MDc5OCw0LjEyOTExIDUuODY2NjcsMS4xNTQ5NSAxNS40NjY2NywzLjAzNzk3IDIxLjMzMzM0LDQuMTg0NDkgMTkuNzA4MjUsMy44NTE1OSA0NS45NjkzMiwxMi41NTE2MiA2MS41OTE4OCwyMC40MDQ3OSA0LjU0MjIsMi4yODMyOCA5LjA3MjIsNC4xNTE0MSAxMC4wNjY2Niw0LjE1MTQxIDAuOTk0NDcsMCAyLjM3ODEyLDAuNTIwMzQgMy4wNzQ3OSwxLjE1NjMgMC42OTY2NywwLjYzNTk2IDYuMzg1MTMsMy44NDY2OSAxMi42NDEwNCw3LjEzNDk1IDYuMjU1ODksMy4yODgyNyAxNi42ODA5Miw5LjUxNzk0IDIzLjE2NjcsMTMuODQzNzEgNi40ODU4LDQuMzI1NzcgMTQuMTgyNiw5LjQzNTIzIDE3LjEwNCwxMS4zNTQzNiAyLjkyMTQyLDEuOTE5MTIgNS42OTYzOSw0LjAyMTU3IDYuMTY2NjMsNC42NzIxMSAwLjQ3MDIzLDAuNjUwNTQgNS4wNTQ5Niw0LjU0MDgxIDEwLjE4ODI5LDguNjQ1MDIgMTcuMTc0NSwxMy43MzE0MyA0MS45NjEzLDM5Ljc4NTUxIDUzLjYwNTkyLDU2LjM0NjYzIDEuNjE2NiwyLjI5OTE1IDMuNDQ4ODMsNC43ODAyNSA0LjA3MTYzLDUuNTEzNTkgNi4yMjMwNyw3LjMyNzUgMjAuMTQ3NjEsMzAuNzc2ODggMjkuNjkwNjYsNDkuOTk5OTkgOC44MDI1NiwxNy43MzE1NCAyMC4xNTU1OSw0Ny4xODIzIDIxLjg0NDUyLDU2LjY2NjY3IDAuNTIyMzYsMi45MzMzMyAxLjc2OTcsOC4zMzMzMyAyLjc3MTg2LDEyIDguNDY0NTcsMzAuOTY5OTcgOS45ODMxMiw2My4xMDkyMiAxMC4wMDEwOSwyMTEuNjY2NjQgbCAwLjAxNDMsMTE4LjMzMzMgaCAyOC42MjYxNiAyOC42MjYxNiB6IE0gNjkwLjk3NzU0LDc1Ni42MzQxNyBjIC0xMS4yNDM3LC0yOS4wNTY3MyAtMzYuOTc0MDgsLTY5Ljk3NDgxIC02Mi44NjA1MywtOTkuOTY0ODQgLTguNTY4MzYsLTkuOTI2NjUgLTQzLjYyMDkzLC00NC42MDUxIC00NS4xMTcwMiwtNDQuNjM1NDkgLTAuOTE2NjcsLTAuMDE4NyAtMS42NjY2NywtMC42MDUwMyAtMS42NjY2NywtMS4zMDMxMyAwLC0wLjY5ODExIC0yLjg1LC0zLjIxNjAzIC02LjMzMzMzLC01LjU5NTM5IC0zLjQ4MzM0LC0yLjM3OTM3IC02LjkzMzM0LC01LjAxNTE2IC03LjY2NjY3LC01Ljg1NzMxIC0wLjczMzMzLC0wLjg0MjE2IC0zLjQzMzMzLC0yLjk0NTMyIC02LC00LjY3MzcgLTIuNTY2NjcsLTEuNzI4MzggLTQuOTY2NjcsLTMuNTI2OTkgLTUuMzMzMzMsLTMuOTk2OTIgLTAuOTkyOTEsLTEuMjcyNTIgLTE0LjUyMjI2LC0xMC42MDc0IC0xNS4zNzM2NiwtMTAuNjA3NCAtMS43MDQxNCwwIC04LjYyNjM0LC01Ljk2NzQ3IC04LjYyNjM0LC03LjQzNjU4IDAsLTEuNzQ4MzIgMTAuNDY0MjYsLTIzLjQ4MTg1IDExLjgyNjgxLC0yNC41NjM0MiAwLjQ2MTkyLC0wLjM2NjY3IDIuMjk1MTEsLTMuMzY2NjcgNC4wNzM3NSwtNi42NjY2NyAxLjc3ODY0LC0zLjMgMy42MDc1NCwtNi4zIDQuMDY0MjQsLTYuNjY2NjcgMC40NTY2OSwtMC4zNjY2NiAyLjI0OTQyLC0yLjc2NjY2IDMuOTgzODUsLTUuMzMzMzMgNC41OTcwMywtNi44MDI4MSAyNS4wNzM1NSwtMjcuNDQzMTYgMzIuMDUxMzUsLTMyLjMwNzc1IDMuMywtMi4zMDA2MSA2LjMsLTQuNTY3MjYgNi42NjY2NiwtNS4wMzcwMiAwLjM2NjY3LC0wLjQ2OTc2IDMuMzY2NjcsLTIuMzA5MzYgNi42NjY2NywtNC4wODggMy4zLC0xLjc3ODY0IDYuMywtMy41Nzg2NCA2LjY2NjY3LC00IDIuNjg4NDQsLTMuMDg5NDQgMjcuODQ3ODMsLTE0LjA4NjMyIDM5LjMzMzMzLC0xNy4xOTIxMyAzMy42MzAyNCwtOS4wOTQwNCA1NS4xMzk4LC05LjM4MjUxIDkwLC0xLjIwNjk5IDE2LjgxNjgzLDMuOTQzOTUgMzYuNzI0OTUsMTIuMjUyOTMgNTIuMDUzMzcsMjEuNzI1MzQgMTQuMjYxMzgsOC44MTMwNCA0MC42MDY1OCwzNC4xMDg0NCA0OC4zNjcyLDQ2LjQzOTg4IDEuMjY5MTYsMi4wMTY2NyAzLjQyMDcyLDMuNjY2NjcgNC43ODEyNCwzLjY2NjY3IDEuMzYwNSwwIDcuNDk2NjgsLTIuNzk1MzEgMTMuNjM1OTIsLTYuMjExNzkgNi4xMzkyNSwtMy40MTY0OCAxNi44NjIyNiwtOC44ODE4MSAyMy44Mjg5MywtMTIuMTQ1MTggNi45NjY2NywtMy4yNjMzOCAxMi44NjQ2MSwtNi4xMTYwMiAxMy4xMDY1MywtNi4zMzkyIDEuNDQ2MiwtMS4zMzQxNiAtMTcuOTI1MzgsLTI2LjE5NDcgLTMwLjY2NjMsLTM5LjM1NTYxIC0xOC44ODk5NiwtMTkuNTEyNjcgLTM2LjM5MDE1LC0zMi45MzE2NCAtNTYuNzc0MTUsLTQzLjUzMzg2IC02LjQxNjM1LC0zLjMzNzI5IC0xMi4zMzE0NSwtNi41OTkwMSAtMTMuMTQ0NjgsLTcuMjQ4MjYgLTAuODEzMjMsLTAuNjQ5MjQgLTQuMTEzMjMsLTIuMDIyNzYgLTcuMzMzMzMsLTMuMDUyMjYgLTMuMjIwMTEsLTEuMDI5NSAtOS4xNTQ3NCwtMy4xNjQ4IC0xMy4xODgwNywtNC43NDUxMiAtOS44NzQ5OSwtMy44NjkxMyAtMTguODA1MTUsLTYuMjA4MTggLTMwLC03Ljg1Nzc4IC01LjEzMzMzLC0wLjc1NjQyIC0xMy4yMzMzMywtMi4wOTA2OCAtMTgsLTIuOTY1MDIgLTEyLjU4OTYxLC0yLjMwOTMgLTQzLjc5NDI4LC0yLjA2MDE3IC01Ny4zMzMzMywwLjQ1Nzc1IC02LjIzMzMzLDEuMTU5MjQgLTE0LjMzMzMzLDIuNTEwNzYgLTE4LDMuMDAzMzcgLTkuMDQ2MiwxLjIxNTM4IC0xNy41ODYwNSwzLjU4OTMyIC0zMi45Nzg1Myw5LjE2NzUxIC0xMy4xNTY2MSw0Ljc2NzkyIC0zOC42NDE5MSwxNi44NTMyNyAtNDIuMzM2MjUsMjAuMDc2MjMgLTEuMTEwMiwwLjk2ODU0IC00LjExODU1LDIuODExMzIgLTYuNjg1MjIsNC4wOTUwNSAtNC41NTE5MiwyLjI3NjY4IC01LjQ0OTk4LDIuOTM4MDkgLTExLjY2NjY2LDguNTkyMjggLTEuNjUsMS41MDA3MSAtMy4zNjAyNywyLjcyODU2IC0zLjgwMDU5LDIuNzI4NTYgLTEuODEyLDAgLTIxLjU1ODg1LDE4LjcwODc1IC0yOS43Mzk1OSwyOC4xNzYxMyAtMTYuMjAyNDIsMTguNzUwNzMgLTE3LjU2OTU4LDIwLjQ2NTE1IC0yMS4xMjQ4NCwyNi40OTA1MyAtMS45NDcxNiwzLjMgLTMuOTU3NzgsNi4zIC00LjQ2ODA2LDYuNjY2NjcgLTEuNTI4ODIsMS4wOTg1NSAtMTUuODY2OTIsMjkuNjY3ODggLTE1Ljg2NjkyLDMxLjYxNTU2IDAsMi43ODQ2OSAtMy42OTUxMiwzLjU1MDI3IC03LjAxMDI5LDEuNDUyNDEgLTYuNDkyNjMsLTQuMTA4NTQgLTQ1LjI1Mjc1LC0xNi4xMDc2IC02MS42NTYzOCwtMTkuMDg3MDkgLTYuNiwtMS4xOTg3OSAtMTcuNywtMy4zMDEwNSAtMjQuNjY2NjYsLTQuNjcxNjkgLTYuOTY2NjcsLTEuMzcwNjQgLTIxLjUxNjY3LC0yLjkxMjc4IC0zMi4zMzMzNCwtMy40MjY5OCAtMTAuODE2NjYsLTAuNTE0MTggLTE5LjY2NjY2LC0xLjQ2NjEyIC0xOS42NjY2NiwtMi4xMTU0IDAsLTAuNjQ5MjYgMS40Mjc2NywtNC42MTI0MiAzLjE3MjYsLTguODA2OTggMS43NDQ5MywtNC4xOTQ1OCAzLjYyNzEsLTkuMTI2NSA0LjE4MjYxLC0xMC45NTk4MyAwLjU1NTQ5LC0xLjgzMzMzIDMuMzI3ODMsLTguMjk0ODcgNi4xNjA3MywtMTQuMzU4OTYgMi44MzI5LC02LjA2NDA5IDUuMTUwNzIsLTExLjg3ODY4IDUuMTUwNzIsLTEyLjkyMTMgMCwtMS4wNDI2MyAwLjY1OTY3LC0yLjMwMzM5IDEuNDY1OTIsLTIuODAxNjggMC44MDYyNiwtMC40OTgzIDMuMDk1MDQsLTQuMjgzNyA1LjA4NjIsLTguNDEyMDIgMTcuMjM2MSwtMzUuNzM2MTMgNTcuNDAxMTgsLTg2LjE2NTIgODguNzgxMjIsLTExMS40Njg4MSA0LjQsLTMuNTQ3OTkgOS4yLC03LjU0OTI4IDEwLjY2NjY2LC04Ljg5MTc2IDUuNTY4MzIsLTUuMDk2ODUgMjkuNjUzOTksLTIxLjg2ODg0IDM4Ljk2NzgzLC0yNy4xMzUxMyAyLjAzNDM2LC0xLjE1MDI5IDUuNDk4ODQsLTMuMjEyMzEgNy42OTg4NCwtNC41ODIyNSAxMC40ODk1LC02LjUzMTkgNDYuODg5ODksLTIzLjU2MTM1IDU2Ljc3ODI2LC0yNi41NjI5OSAyLjUwNTI4LC0wLjc2MDQ5IDkuMzU1MDcsLTMuMTE1OTEgMTUuMjIxNzQsLTUuMjM0MjcgNS44NjY2NiwtMi4xMTgzNiAxNS40NjY2NiwtNC45MjAzNiAyMS4zMzMzMywtNi4yMjY2NiA1Ljg2NjY3LC0xLjMwNjMyIDE0Ljg2NjY3LC0zLjQ2ODEyIDIwLC00LjgwNDAyIDUuMTMzMzMsLTEuMzM1ODkgMTYuMjMzMzMsLTMuMjE3NDIgMjQuNjY2NjYsLTQuMTgxMTggMTkuOTc3NDgsLTIuMjgzMDMgODMuOTA4OTUsLTIuMzA3NzYgMTAzLjMzMzM0LC0wLjA0IDI5LjQ0Nzc1LDMuNDM4MDEgNzIuODYxNjksMTUuNzQ1MDggMTAyLjY2NjY2LDI5LjEwNDE0IDE1LjgzMzQzLDcuMDk2OCAzOC4xMjcyOCwxOC42OTk5OSAzOS4zMzMzMywyMC40NzE2NyAwLjM2NjY3LDAuNTM4NjMgMi4xNjY2NywxLjc1MjI5IDQsMi42OTcwMyA0Ljk1MTg0LDIuNTUxNzMgMjEuNzk2ODMsMTMuNjM3NDIgMjMuMzMzMzMsMTUuMzU1NjYgMC43MzMzNCwwLjgyMDA3IDUuMDI4MzQsMy45ODg4OCA5LjU0NDQ2LDcuMDQxNzkgNC41MTYxLDMuMDUyOTIgOC40MTYxLDYuMDE1NzUgOC42NjY2Niw2LjU4NDA3IDAuMjUwNTUsMC41NjgzMyAzLjQ1MTc0LDMuNDMzMzEgNy4xMTM3NSw2LjM2NjY1IDEwLjUwMTE3LDguNDExNjQgMzEuMzM5MTksMjkuNDkyOTIgNDIuODMzMjgsNDMuMzMzMzMgMTEuOTcyNDQsMTQuNDE2NDEgMjUuMjYyMjEsMzEuOTMxMTYgMjcuNTk3MDEsMzYuMzcwMzUgMC44NjgsMS42NTAyOCAzLjAyMzMsNS4wMTgzNCA0Ljc4OTYsNy40ODQ1NiAxLjc2NjQsMi40NjYyMiA0Ljk5MzEsNy44NTc3OCA3LjE3MDYsMTEuOTgxMjQgMTAuNzMxOCwyMC4zMjI0OSAxOC41NzM2LDM2LjEzOTYzIDIwLjkwMzksNDIuMTYzODUgMS40MTg0LDMuNjY2NjYgNC40MDkzLDExLjA3ODg0IDYuNjQ2NSwxNi40NzE0OCAyLjIzNzEsNS4zOTI2NSA0LjA2NzYsMTAuNTU1OCA0LjA2NzYsMTEuNDczNjYgMCwxLjIxNzgzIC01LjMxNTEsMS45MjU5IC0xOS42NjY3LDIuNjE5OTQgLTEwLjgxNjcsMC41MjMxIC0yNC4xNjY3LDEuODQ2MjIgLTI5LjY2NjcsMi45NDAyOCAtNS41LDEuMDk0MDQgLTEyLjk5OTk2LDIuNDg4NCAtMTYuNjY2NjIsMy4wOTg1NiAtMy42NjY2NywwLjYxMDE2IC0xMC4yNjY2NywxLjgxMDk3IC0xNC42NjY2NywyLjY2ODQ1IC0xMi44MTMwNCwyLjQ5NzA1IC01NC4wNiwxNS42NTU3OSAtNTguNjY2NjcsMTguNzE2MDMgLTAuNzMzMzMsMC40ODcxNiAtNC4zMzMzMywxLjk4NzA5IC04LDMuMzMzMTggLTYuMDE3NjksMi4yMDkxOSAtMjMuNjI2NzMsMTAuOTYxMjcgLTQzLjMzMzMzLDIxLjUzNzYgLTUwLjMyMTQsMjcuMDA3MDIgLTExMi4xODU5NCw4Ny4zMjgyNCAtMTQxLjMzMzMzLDEzNy44MDc1MSAtMy4xODgxNyw1LjUyMTQ4IC00Ljg3MjYxLDguNDkzMjEgLTYuNjEyOTIsMTEuNjY2NjYgLTAuNzAzNzcsMS4yODMzNCAtMi42NTk1Niw0LjczMzM0IC00LjM0NjIxLDcuNjY2NjcgLTIuODAxNjUsNC44NzI1MyAtMTMuMzgzMjEsMjcuMzY0OTIgLTE2LjYwNzMxLDM1LjMwMDg1IC0xLjI0MDQ5LDMuMDUzNDQgLTEuNjQ5NDYsMi41MDM3NiAtNS40NTYsLTcuMzMzMzMgeiBtIC0xNzAuOTk3OTcsOTkuNjk5MTQgYyAtMC4wMTA3LC05MS40ODMzMyAtMC40NjEyMiwtMTY3LjAwNDkgLTEsLTE2Ny44MjU3IC0xLjI3NzQ4LC0xLjk0NjIgLTIwLjMzMzcyLC0xNy4wNDQ2OSAtMjMuOTY2MzIsLTE4Ljk4ODggLTEuNTQyOTMsLTAuODI1NzUgLTMuNjAyMTIsLTIuMjc5NDMgLTQuNTc1OTYsLTMuMjMwMzkgLTMuNDkwNDEsLTMuNDA4MzYgLTIxLjgzNjgzLC0xMy4yMTIyNiAtMjUuMTAzOTcsLTEzLjQxNDk2IGwgLTMuMzMzMzMsLTAuMjA2ODEgLTAuMzM4MDEsMTg1IC0wLjMzODAyLDE4NC45OTk5NSBoIDI5LjMzODAxIDI5LjMzODAyIHoiCiAgICBmaWxsPSIjOGMwMTlhIiAvPgo8L3N2Zz4K'

function isResponseError(error: any): error is ResponseError {
  return typeof error === 'object' && 'code' in error && 'message' in error
}

export class KibisisWallet extends BaseWallet {
  public methods: ProviderMethod[] = []
  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    metadata = {}
  }: WalletConstructor<WalletId.KIBISIS>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.store = store
  }

  static defaultMetadata = {
    name: 'Kibisis',
    icon
  }

  static async sendRequestWithTimeout<Params, Result>({
    method,
    params,
    timeout,
    reference
  }: SendRequestWithTimeoutOptions<Params>): Promise<Result | undefined> {
    return new Promise<Result | undefined>((resolve, reject) => {
      const channel = new BroadcastChannel(ARC_0027_CHANNEL_NAME)
      const requestId = generateUuid()
      // eslint-disable-next-line prefer-const
      let timer: number

      // listen to responses
      channel.onmessage = (message: MessageEvent<ResponseMessage<Result>>) => {
        // if the response's request id does not match the intended request, just ignore
        if (!message.data || message.data.requestId !== requestId) {
          return
        }

        // clear the timer, we can handle it from here
        window.clearTimeout(timer)

        // if there is an error, reject
        if (message.data.error) {
          reject(message.data.error)

          // close the channel, we are done here
          return channel.close()
        }

        // return the result
        resolve(message.data.result)

        // close the channel, we are done here
        return channel.close()
      }

      timer = window.setTimeout(() => {
        // close the channel connection
        channel.close()

        reject({
          code: METHOD_TIMED_OUT_ERROR,
          data: {
            method
          },
          message: `No response from provider "${WalletId.KIBISIS.toUpperCase()}"`,
          providerId: ARC_0027_PROVIDER_ID
        } as ResponseError<{ method: ProviderMethod }>)
      }, timeout || DEFAULT_REQUEST_TIMEOUT)

      // broadcast the request
      channel.postMessage({
        id: requestId,
        params,
        reference
      } as RequestMessage<Params>)
    })
  }

  /**
   * Calls the enable method on the provider that returns the authorized accounts.
   * @returns {Arc0027Account[]} the authorized accounts.
   * @throws {METHOD_CANCELED_ERROR} if the method was cancelled by the user.
   * @throws {METHOD_NOT_SUPPORTED_ERROR} if the method is not supported for the configured network.
   * @throws {METHOD_TIMED_OUT_ERROR} if the method timed out by lack of response.
   * @throws {NETWORK_NOT_SUPPORTED_ERROR} if the network is not supported for the configured network.
   * @throws {UNKNOWN_ERROR} if the response result was empty.
   */
  private async enable(): Promise<Arc0027Account[]> {
    const method = 'enable'

    // check the method is supported
    this.validateMethod(method)

    const genesisHash = await this.getGenesisHash()

    const result = await KibisisWallet.sendRequestWithTimeout<EnableParams, EnableResult>({
      method,
      params: {
        genesisHash,
        providerId: ARC_0027_PROVIDER_ID
      },
      reference: ARC_0027_ENABLE_REQUEST
    })

    // check for a result
    if (!result) {
      throw {
        code: UNKNOWN_ERROR,
        message: `Received response, but "${method}" request details were empty for provider "${this.name}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError
    }

    return result.accounts
  }

  /**
   * Gets the genesis hash of the algod client's configured network.
   * @returns {string} the genesis hash
   */
  private async getGenesisHash(): Promise<string> {
    const algodClient = this.getAlgodClient()
    const version = await algodClient.versionsCheck().do()
    const genesisHash = version.genesis_hash_b64

    return genesisHash
  }

  /**
   * Gets the provider information and updates the supported methods. This should be called
   * before interacting with the provider to ensure methods are supported.
   * @throws {METHOD_TIMED_OUT_ERROR} if the method timed out by lack of response.
   * @throws {NETWORK_NOT_SUPPORTED_ERROR} if the network is not supported for the configured network.
   * @throws {UNKNOWN_ERROR} if the response result was empty.
   */
  private async getSupportedMethods(): Promise<void> {
    const genesisHash = await this.getGenesisHash()

    const result = await KibisisWallet.sendRequestWithTimeout<
      GetProvidersParams,
      GetProvidersResult
    >({
      method: 'getProviders',
      params: {
        providerId: ARC_0027_PROVIDER_ID
      },
      reference: ARC_0027_GET_PROVIDERS_REQUEST,
      timeout: LOWER_REQUEST_TIMEOUT
    })

    // check for a result
    if (!result) {
      throw {
        code: UNKNOWN_ERROR,
        message: `Received response, but provider details were empty for provider "${this.name}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError
    }

    const networkConfiguration = result.networks.find((value) => value.genesisHash === genesisHash)

    // check if the network is supported
    if (!networkConfiguration) {
      throw {
        code: NETWORK_NOT_SUPPORTED_ERROR,
        data: {
          genesisHash
        },
        message: `Network "${this.activeNetwork}" not supported on provider "${this.name}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError<{ genesisHash: string }>
    }

    this.methods = networkConfiguration.methods
  }

  /**
   * Calls the signTxns methods to sign the supplied transactions.
   * @param {Arc0001SignTxns[]} txns -  the unsigned or signed transactions as defined in ARC-0001.
   * @returns {(string | null)[]} the authorized accounts.
   * @throws {INVALID_INPUT_ERROR} if computed group ID for the txns does not match the assigned group ID.
   * @throws {INVALID_GROUP_ID_ERROR} if the unsigned txns is malformed or not conforming to ARC-0001.
   * @throws {METHOD_CANCELED_ERROR} if the method was cancelled by the user.
   * @throws {METHOD_NOT_SUPPORTED_ERROR} if the method is not supported for the configured network.
   * @throws {METHOD_TIMED_OUT_ERROR} if the method timed out by lack of response.
   * @throws {NETWORK_NOT_SUPPORTED_ERROR} if the network is not supported for the configured network.
   * @throws {UNAUTHORIZED_SIGNER_ERROR} if a signer in the request is not authorized by the provider.
   * @throws {UNKNOWN_ERROR} if the response result was empty.
   */
  private async signTxns(txns: Arc0001SignTxns[]): Promise<(string | null)[]> {
    const method = 'signTxns'

    // check the method is supported
    this.validateMethod(method)

    const result = await KibisisWallet.sendRequestWithTimeout<SignTxnsParams, SignTxnsResult>({
      method,
      params: {
        providerId: ARC_0027_PROVIDER_ID,
        txns
      },
      reference: ARC_0027_SIGN_TXNS_REQUEST
    })

    // check for a result
    if (!result) {
      throw {
        code: UNKNOWN_ERROR,
        message: `Received response, but "${method}" request details were empty for provider "${this.name}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError
    }

    return result.stxns
  }

  /**
   * Validates whether a method is supported with the provider.
   * @param {ProviderMethod} method -  the method to validate.
   * @throws {METHOD_NOT_SUPPORTED_ERROR} if the method is not supported for the configured network.
   */
  private validateMethod(method: ProviderMethod): void {
    if (!this.methods.includes(method)) {
      throw {
        code: METHOD_NOT_SUPPORTED_ERROR,
        data: {
          method
        },
        message: `"${method}" operation not supported on "${this.activeNetwork}" for provider "${this.name}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError<{ method: string }>
    }
  }

  public async connect(): Promise<WalletAccount[]> {
    console.info('[KibisisWallet] Connecting...')
    try {
      await this.getSupportedMethods()

      const accounts: Arc0027Account[] = await this.enable()

      const walletAccounts = accounts.map(({ address, name }, idx) => ({
        name: name || `Kibisis Wallet ${idx + 1}`,
        address
      }))

      const activeAccount = walletAccounts[0]!

      addWallet(this.store, {
        walletId: this.id,
        wallet: {
          accounts: walletAccounts,
          activeAccount
        }
      })

      return walletAccounts
    } catch (error: any) {
      console.error(`[KibisisWallet] Error connecting: ${error.message}`)
      return []
    }
  }

  public async disconnect(): Promise<void> {
    console.info('[KibisisWallet] Disconnecting...')
    this.onDisconnect()
  }

  public resumeSession(): Promise<void> {
    return Promise.resolve()
  }

  public signTransactions = async (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> => {
    try {
      await this.getSupportedMethods()

      const txnsToSign: Arc0001SignTxns[] = []
      const signedIndexes: number[] = []

      const msgpackTxnGroup: Uint8Array[] = normalizeTxnGroup(txnGroup)

      // Decode transactions to access properties
      const decodedObjects = msgpackTxnGroup.map((txn) => {
        return algosdk.decodeObj(txn)
      }) as Array<algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction>

      // Marshal transactions into `Arc0001SignTxns[]`
      decodedObjects.forEach((txnObject, idx) => {
        const isSigned = isSignedTxnObject(txnObject)
        const shouldSign = shouldSignTxnObject(txnObject, this.addresses, indexesToSign, idx)

        const txnBuffer: Uint8Array = msgpackTxnGroup[idx]!
        const txn: algosdk.Transaction = isSigned
          ? algosdk.decodeSignedTransaction(txnBuffer).txn
          : algosdk.decodeUnsignedTransaction(txnBuffer)

        const txnBase64 = Buffer.from(txn.toByte()).toString('base64')

        if (shouldSign) {
          txnsToSign.push({ txn: txnBase64 })
          signedIndexes.push(idx)
        } else {
          txnsToSign.push({ txn: txnBase64, signers: [] })
        }
      })

      // Sign transactions
      const signTxnsResult = await this.signTxns(txnsToSign)

      // Filter out null results
      const signedTxnsBase64 = signTxnsResult.filter(Boolean) as string[]

      // Convert base64 signed transactions to msgpack
      const signedTxns = signedTxnsBase64.map((txn) => new Uint8Array(Buffer.from(txn, 'base64')))

      // Merge signed transactions back into original group
      const txnGroupSigned = mergeSignedTxnsWithGroup(
        signedTxns,
        msgpackTxnGroup,
        signedIndexes,
        returnGroup
      )

      return txnGroupSigned
    } catch (error: any) {
      console.error(
        `[KibisisWallet] Error signing transactions: ` +
          (isResponseError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
      throw error
    }
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    try {
      const txnsToSign = txnGroup.reduce<Arc0001SignTxns[]>((acc, txn, idx) => {
        const txnBase64 = Buffer.from(txn.toByte()).toString('base64')

        if (indexesToSign.includes(idx)) {
          acc.push({ txn: txnBase64 })
        } else {
          acc.push({ txn: txnBase64, signers: [] })
        }
        return acc
      }, [])

      const signTxnsResult = await this.signTxns(txnsToSign)
      const signedTxnsBase64 = signTxnsResult.filter(Boolean) as string[]

      const signedTxns = signedTxnsBase64.map((txn) => new Uint8Array(Buffer.from(txn, 'base64')))
      return signedTxns
    } catch (error: any) {
      console.error(
        `[KibisisWallet] Error signing transactions: ` +
          (isResponseError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
      throw error
    }
  }
}
