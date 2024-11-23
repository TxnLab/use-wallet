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

export class NetworkConfigBuilder {
  private networks: Map<string, NetworkConfig>

  constructor() {
    // Initialize with default networks
    this.networks = new Map(Object.entries(DEFAULT_NETWORKS))
  }

  // Methods to customize default networks
  mainnet(config: Partial<AlgodConfig>) {
    this.networks.set('mainnet', {
      ...DEFAULT_NETWORKS.mainnet,
      algod: { ...DEFAULT_NETWORKS.mainnet.algod, ...config }
    })
    return this
  }

  testnet(config: Partial<AlgodConfig>) {
    this.networks.set('testnet', {
      ...DEFAULT_NETWORKS.testnet,
      algod: { ...DEFAULT_NETWORKS.testnet.algod, ...config }
    })
    return this
  }

  betanet(config: Partial<AlgodConfig>) {
    this.networks.set('betanet', {
      ...DEFAULT_NETWORKS.betanet,
      algod: { ...DEFAULT_NETWORKS.betanet.algod, ...config }
    })
    return this
  }

  fnet(config: Partial<AlgodConfig>) {
    this.networks.set('fnet', {
      ...DEFAULT_NETWORKS.fnet,
      algod: { ...DEFAULT_NETWORKS.fnet.algod, ...config }
    })
    return this
  }

  localnet(config: Partial<AlgodConfig>) {
    this.networks.set('localnet', {
      ...DEFAULT_NETWORKS.localnet,
      algod: { ...DEFAULT_NETWORKS.localnet.algod, ...config }
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

// Type guard for runtime validation
export function isNetworkConfig(config: unknown): config is NetworkConfig {
  if (typeof config !== 'object' || config === null) return false

  const { name, algod, isTestnet, genesisHash, genesisId } = config as NetworkConfig

  return (
    typeof name === 'string' &&
    typeof algod === 'object' &&
    typeof algod.token === 'string' &&
    typeof algod.baseServer === 'string' &&
    (isTestnet === undefined || typeof isTestnet === 'boolean') &&
    (genesisHash === undefined || typeof genesisHash === 'string') &&
    (genesisId === undefined || typeof genesisId === 'string')
  )
}

export enum NetworkId {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  BETANET = 'betanet',
  FNET = 'fnet',
  LOCALNET = 'localnet'
}
