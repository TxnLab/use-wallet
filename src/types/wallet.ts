import type { PROVIDER_ID } from '../constants'

export interface Account {
  providerId: PROVIDER_ID
  name: string
  address: string
  authAddr?: string
  email?: string
}

export type Provider = {
  accounts: Account[]
  isActive: boolean
  isConnected: boolean
  connect: (onDisconnect?: () => void, email?: string) => Promise<void>
  disconnect: () => Promise<void>
  reconnect: () => Promise<void>
  setActiveProvider: () => void
  setActiveAccount: (account: string) => void
  metadata: Metadata
}

export type Asset = {
  amount: number
  'asset-id': number
  creator: string
  'is-frozen': boolean
  'unit-name': string
  name: string
}

// We can add more properties as needed...
// See https://algorand.github.io/js-algorand-sdk/classes/modelsv2.Account.html
// but keep in mind the actual properties are kebab case not camel case
export type AccountInfo = {
  address: string
  amount: number
  'min-balance': number
  'auth-addr'?: string
  assets?: Asset[]
}

export type WalletProvider = {
  id: PROVIDER_ID
  name: string
  icon: string
  isWalletConnect: boolean
}

type ExtendValues<Type> = {
  [Property in keyof Type]: Type[Property] | null
}

// This type extends the values of `WalletProvider` with `null` values
// and adds the `accounts` property.
export type Wallet = ExtendValues<WalletProvider> & {
  accounts: Account[]
}

export type Metadata = {
  id: PROVIDER_ID
  name: string
  icon: string
  isWalletConnect: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientOptions = Record<string, any>
