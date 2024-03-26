import algosdk from 'algosdk'

export enum NetworkId {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  BETANET = 'betanet',
  LOCALNET = 'localnet'
}

export function isValidNetworkId(networkId: any): networkId is NetworkId {
  return Object.values(NetworkId).includes(networkId)
}

export interface AlgodConfig {
  token: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader | algosdk.BaseHTTPClient
  baseServer: string
  port?: string | number
  headers?: Record<string, string>
}

export function isAlgodConfig(config: any): config is AlgodConfig {
  if (typeof config !== 'object') return false

  for (const key of Object.keys(config)) {
    if (!['token', 'baseServer', 'port', 'headers'].includes(key)) return false
  }

  return (
    typeof config.token === 'string' &&
    typeof config.baseServer === 'string' &&
    ['string', 'number', 'undefined'].includes(typeof config.port) &&
    ['object', 'undefined'].includes(typeof config.headers)
  )
}

export type NetworkConfigMap = Record<NetworkId, AlgodConfig>

export function isNetworkConfigMap(config: NetworkConfig): config is NetworkConfigMap {
  const networkKeys = Object.values(NetworkId) as string[]
  return Object.keys(config).some((key) => networkKeys.includes(key))
}

export type NetworkConfig = Partial<AlgodConfig> | Partial<Record<NetworkId, Partial<AlgodConfig>>>

export const nodeServerMap = {
  [NetworkId.MAINNET]: 'https://mainnet-api.algonode.cloud',
  [NetworkId.TESTNET]: 'https://testnet-api.algonode.cloud',
  [NetworkId.BETANET]: 'https://betanet-api.algonode.cloud',
  [NetworkId.LOCALNET]: 'http://localhost'
}

export function createDefaultNetworkConfig(): NetworkConfigMap {
  return Object.values(NetworkId).reduce((acc, value) => {
    acc[value as NetworkId] = {
      token: '',
      baseServer: nodeServerMap[value as NetworkId],
      port: '',
      headers: {}
    }
    return acc
  }, {} as NetworkConfigMap)
}

export const caipChainId: Partial<Record<NetworkId, string>> = {
  [NetworkId.MAINNET]: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
  [NetworkId.TESTNET]: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
  [NetworkId.BETANET]: 'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2'
}
