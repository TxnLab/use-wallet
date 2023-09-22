import { Network } from '../types/node'

export enum PROVIDER_ID {
  KMD = 'kmd',
  PERA = 'pera',
  DAFFI = 'daffi',
  MYALGO = 'myalgo',
  ALGOSIGNER = 'algosigner',
  DEFLY = 'defly',
  EXODUS = 'exodus',
  WALLETCONNECT = 'walletconnect',
  MNEMONIC = 'mnemonic',
  METAMASK = 'metamask'
}

export const DEFAULT_NETWORK: Network = 'mainnet'

export const DEFAULT_NODE_BASEURL = 'https://mainnet-api.algonode.cloud'

export const DEFAULT_NODE_TOKEN = ''

export const DEFAULT_NODE_PORT = ''
