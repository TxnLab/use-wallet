import algosdk from 'algosdk'

export enum NetworkId {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  BETANET = 'betanet',
  FNET = 'fnet',
  LOCALNET = 'localnet',
  VOIMAIN = 'voimain',
  ARAMIDMAIN = 'aramidmain'
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
  [NetworkId.MAINNET]: 'https://mainnet-api.4160.nodely.dev',
  [NetworkId.TESTNET]: 'https://testnet-api.4160.nodely.dev',
  [NetworkId.BETANET]: 'https://betanet-api.4160.nodely.dev',
  [NetworkId.FNET]: 'https://fnet-api.4160.nodely.dev',
  [NetworkId.VOIMAIN]: 'https://mainnet-api.voi.nodely.dev',
  [NetworkId.ARAMIDMAIN]: 'https://algod.aramidmain.a-wallet.net'
}

export function createDefaultNetworkConfig(): NetworkConfigMap {
  const localnetConfig: AlgodConfig = {
    token: 'a'.repeat(64),
    baseServer: 'http://localhost',
    port: 4001,
    headers: {}
  }

  return Object.values(NetworkId).reduce((configMap, value) => {
    const network = value as NetworkId
    const isLocalnet = network === NetworkId.LOCALNET

    configMap[network] = isLocalnet
      ? localnetConfig
      : {
          token: '',
          baseServer: nodeServerMap[network],
          port: '',
          headers: {}
        }

    return configMap
  }, {} as NetworkConfigMap)
}

export const caipChainId: Partial<Record<NetworkId, string>> = {
  [NetworkId.MAINNET]: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
  [NetworkId.TESTNET]: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
  [NetworkId.BETANET]: 'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2',
  [NetworkId.FNET]: 'algorand:kUt08LxeVAAGHnh4JoAoAMM9ql_hBwSo',
  [NetworkId.VOIMAIN]: 'algorand:r20fSQI8gWe_kFZziNonSPCXLwcQmH_n',
  [NetworkId.ARAMIDMAIN]: 'algorand:PgeQVJJgx_LYKJfIEz7dbfNPuXmDyJ-O'
}
