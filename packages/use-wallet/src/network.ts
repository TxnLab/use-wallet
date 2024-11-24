import algosdk from 'algosdk'

export interface AlgodConfig {
  token: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader | algosdk.BaseHTTPClient
  baseServer: string
  port?: string | number
  headers?: Record<string, string>
}

export interface NetworkConfig {
  name: string
  algod: AlgodConfig
  genesisHash?: string
  genesisId?: string
  isTestnet?: boolean
  caipChainId?: string
}

// Default configurations
export const DEFAULT_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: 'MainNet',
    algod: {
      token: '',
      baseServer: 'https://mainnet-api.4160.nodely.dev',
      headers: {}
    },
    isTestnet: false,
    genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    genesisId: 'mainnet-v1.0',
    caipChainId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
  },
  testnet: {
    name: 'TestNet',
    algod: {
      token: '',
      baseServer: 'https://testnet-api.4160.nodely.dev',
      headers: {}
    },
    isTestnet: true,
    genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    genesisId: 'testnet-v1.0',
    caipChainId: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
  },
  betanet: {
    name: 'BetaNet',
    algod: {
      token: '',
      baseServer: 'https://betanet-api.4160.nodely.dev',
      headers: {}
    },
    isTestnet: true,
    genesisHash: 'mFgazF-2uRS1tMiL9dsj01hJGySEmPN2OvOTQHJ6iQg=',
    genesisId: 'betanet-v1.0',
    caipChainId: 'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2'
  },
  fnet: {
    name: 'FNet',
    algod: {
      token: '',
      baseServer: 'https://fnet-api.4160.nodely.dev',
      headers: {}
    },
    isTestnet: true,
    genesisHash: 'kUt08LxeVAAGHnh4JoAoAMM9ql_hBwSoRrQQKWSVgxk=',
    genesisId: 'fnet-v1.0',
    caipChainId: 'algorand:kUt08LxeVAAGHnh4JoAoAMM9ql_hBwSo'
  },
  localnet: {
    name: 'LocalNet',
    algod: {
      token: 'a'.repeat(64),
      baseServer: 'http://localhost',
      port: 4001,
      headers: {}
    },
    isTestnet: true
  }
}

// Type for configuring default networks, excluding immutable identifiers
export type DefaultNetworkConfig = Omit<
  Partial<NetworkConfig>,
  'genesisHash' | 'genesisId' | 'caipChainId'
>

export class NetworkConfigBuilder {
  private networks: Map<string, NetworkConfig>

  constructor() {
    this.networks = new Map(Object.entries(DEFAULT_NETWORKS))
  }

  // Methods to customize default networks
  mainnet(config: DefaultNetworkConfig) {
    this.networks.set('mainnet', {
      ...DEFAULT_NETWORKS.mainnet,
      ...config,
      genesisHash: DEFAULT_NETWORKS.mainnet.genesisHash!,
      genesisId: DEFAULT_NETWORKS.mainnet.genesisId!,
      caipChainId: DEFAULT_NETWORKS.mainnet.caipChainId!,
      algod: {
        ...DEFAULT_NETWORKS.mainnet.algod,
        ...(config.algod || {})
      }
    })
    return this
  }

  testnet(config: DefaultNetworkConfig) {
    this.networks.set('testnet', {
      ...DEFAULT_NETWORKS.testnet,
      ...config,
      genesisHash: DEFAULT_NETWORKS.testnet.genesisHash!,
      genesisId: DEFAULT_NETWORKS.testnet.genesisId!,
      caipChainId: DEFAULT_NETWORKS.testnet.caipChainId!,
      algod: {
        ...DEFAULT_NETWORKS.testnet.algod,
        ...(config.algod || {})
      }
    })
    return this
  }

  betanet(config: DefaultNetworkConfig) {
    this.networks.set('betanet', {
      ...DEFAULT_NETWORKS.betanet,
      ...config,
      genesisHash: DEFAULT_NETWORKS.betanet.genesisHash!,
      genesisId: DEFAULT_NETWORKS.betanet.genesisId!,
      caipChainId: DEFAULT_NETWORKS.betanet.caipChainId!,
      algod: {
        ...DEFAULT_NETWORKS.betanet.algod,
        ...(config.algod || {})
      }
    })
    return this
  }

  fnet(config: DefaultNetworkConfig) {
    this.networks.set('fnet', {
      ...DEFAULT_NETWORKS.fnet,
      ...config,
      genesisHash: DEFAULT_NETWORKS.fnet.genesisHash!,
      genesisId: DEFAULT_NETWORKS.fnet.genesisId!,
      caipChainId: DEFAULT_NETWORKS.fnet.caipChainId!,
      algod: {
        ...DEFAULT_NETWORKS.fnet.algod,
        ...(config.algod || {})
      }
    })
    return this
  }

  localnet(config: Partial<NetworkConfig>) {
    this.networks.set('localnet', {
      ...DEFAULT_NETWORKS.localnet,
      ...config,
      algod: {
        ...DEFAULT_NETWORKS.localnet.algod,
        ...(config.algod || {})
      }
    })
    return this
  }

  // Method to add custom networks (still needs full NetworkConfig)
  addNetwork(id: string, config: NetworkConfig) {
    if (DEFAULT_NETWORKS[id]) {
      throw new Error(
        `Cannot add network with reserved id "${id}". Use the ${id}() method instead.`
      )
    }
    this.networks.set(id, config)
    return this
  }

  build() {
    return Object.fromEntries(this.networks)
  }
}

// Create a default builder with common presets
export const createNetworkConfig = () => new NetworkConfigBuilder().build()

// Check if the algod token is valid
function isValidToken(
  token: unknown
): token is string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader | algosdk.BaseHTTPClient {
  if (typeof token === 'string') return true
  if (typeof token !== 'object' || token === null) return false

  // Check if it's an AlgodTokenHeader
  if ('X-Algo-API-Token' in token && typeof token['X-Algo-API-Token'] === 'string') return true

  // Check if it's a BaseHTTPClient
  if ('get' in token && 'post' in token && 'delete' in token) return true

  // Check if it's a CustomTokenHeader (object with string values)
  return Object.values(token).every((value) => typeof value === 'string')
}

// Type guard for runtime validation
export function isNetworkConfig(config: unknown): config is NetworkConfig {
  if (typeof config !== 'object' || config === null) return false

  const { name, algod, isTestnet, genesisHash, genesisId, caipChainId } = config as NetworkConfig

  const isValidAlgod =
    typeof algod === 'object' &&
    algod !== null &&
    isValidToken(algod.token) &&
    typeof algod.baseServer === 'string'

  return (
    typeof name === 'string' &&
    isValidAlgod &&
    (isTestnet === undefined || typeof isTestnet === 'boolean') &&
    (genesisHash === undefined || typeof genesisHash === 'string') &&
    (genesisId === undefined || typeof genesisId === 'string') &&
    (caipChainId === undefined || typeof caipChainId === 'string')
  )
}

export enum NetworkId {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  BETANET = 'betanet',
  FNET = 'fnet',
  LOCALNET = 'localnet'
}
