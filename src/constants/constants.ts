import { Network } from '../types/node'

export enum PROVIDER_ID {
  KMD = 'kmd',
  CUSTOM = 'custom',
  PERA = 'pera',
  DAFFI = 'daffi',
  LUTE = 'lute',
  MYALGO = 'myalgo',
  ALGOSIGNER = 'algosigner',
  DEFLY = 'defly',
  EXODUS = 'exodus',
  KIBISIS = 'kibisis',
  WALLETCONNECT = 'walletconnect',
  MNEMONIC = 'mnemonic',
  MAGIC = 'magic'
}

export const DEFAULT_NETWORK: Network = 'mainnet'

export const DEFAULT_NODE_BASEURL = 'https://mainnet-api.algonode.cloud'

export const DEFAULT_NODE_TOKEN = ''

export const DEFAULT_NODE_PORT = ''
