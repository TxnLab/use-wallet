import { Store } from '@tanstack/vue-store'
import {
  NetworkId,
  WalletManager,
  WalletId,
  DEFAULT_NETWORK_CONFIG,
  type AlgodConfig,
  type State
} from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { computed, inject, nextTick, ref, type InjectionKey } from 'vue'
import { useNetwork } from '../useNetwork'
import { useWallet } from '../useWallet'
import type { Mock } from 'vitest'

// Mock Vue's inject function
vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  return {
    ...mod,
    inject: vi.fn()
  }
})

let mockStore: Store<State>
let mockWalletManager: WalletManager
const mockAlgodClient = ref(new algosdk.Algodv2('token', 'https://server', ''))
const mockSetAlgodClient = (client: algosdk.Algodv2) => {
  mockAlgodClient.value = client
}

const setupMocks = () => {
  mockStore = new Store<State>({
    activeNetwork: NetworkId.TESTNET,
    activeWallet: null,
    algodClient: new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''),
    managerStatus: 'ready',
    wallets: {},
    networkConfig: DEFAULT_NETWORK_CONFIG,
    customNetworkConfigs: {}
  })

  mockWalletManager = new WalletManager({
    wallets: [WalletId.DEFLY]
  })

  vi.spyOn(mockWalletManager, 'store', 'get').mockReturnValue(mockStore)
  ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
    if (token === 'walletManager') return mockWalletManager
    if (token === 'setAlgodClient') return mockSetAlgodClient
    if (token === 'algodClient') return mockAlgodClient
    return null
  })
}

beforeEach(() => {
  setupMocks()
  vi.clearAllMocks()
  mockStore.setState((state) => ({
    ...state,
    activeNetwork: NetworkId.TESTNET,
    activeWallet: null,
    algodClient: new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''),
    managerStatus: 'ready',
    networkConfig: { ...DEFAULT_NETWORK_CONFIG },
    customNetworkConfigs: {},
    wallets: {}
  }))
})

describe('useNetwork', () => {
  it('throws error for invalid network', async () => {
    const { setActiveNetwork } = useNetwork()

    await expect(setActiveNetwork('invalid-network')).rejects.toThrow(
      'Network "invalid-network" not found in network configuration'
    )
  })

  it('allows setting custom network that exists in config', async () => {
    const customNetwork = {
      algod: {
        token: '',
        baseServer: 'https://custom.network',
        headers: {}
      }
    }

    mockWalletManager.networkConfig['custom-net'] = customNetwork
    const { setActiveNetwork, activeNetwork } = useNetwork()

    await setActiveNetwork('custom-net')
    expect(activeNetwork.value).toBe('custom-net')
  })

  it('updates algodClient when setActiveNetwork is called', async () => {
    const TestComponent = {
      template: `
        <div>
          <div data-testid="active-network">{{ activeNetwork }}</div>
        </div>
      `,
      setup() {
        const { setActiveNetwork, activeNetwork } = useNetwork()
        const { algodClient } = useWallet()
        return { setActiveNetwork, activeNetwork, algodClient }
      }
    }

    const wrapper = mount(TestComponent)
    const newClient = new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev/', '')

    mockWalletManager.setActiveNetwork = async (networkId: string) => {
      mockSetAlgodClient(newClient)
      mockWalletManager.store.setState((state) => ({
        ...state,
        activeNetwork: networkId,
        algodClient: newClient
      }))
    }

    const { setActiveNetwork } = useNetwork()
    await setActiveNetwork(NetworkId.MAINNET)
    await nextTick()

    expect(wrapper.get('[data-testid="active-network"]').text()).toBe(NetworkId.MAINNET)
  })

  it('integrates correctly with Vue component', async () => {
    const TestComponent = {
      template: `
        <div>
          <div data-testid="activeNetwork">{{ activeNetwork }}</div>
          <div data-testid="algodClient">{{ algodClient }}</div>
        </div>
      `,
      setup() {
        const { activeNetwork } = useNetwork()
        const { algodClient } = useWallet()
        return { activeNetwork, algodClient }
      }
    }

    const wrapper = mount(TestComponent)

    expect(wrapper.get('[data-testid="activeNetwork"]').text()).toBe(NetworkId.TESTNET)

    // Test network change
    const newClient = new algosdk.Algodv2('', 'https://mainnet-api.algonode.cloud', '')
    mockWalletManager.setActiveNetwork = async (networkId: string) => {
      mockSetAlgodClient(newClient)
      mockWalletManager.store.setState((state) => ({
        ...state,
        activeNetwork: networkId,
        algodClient: newClient
      }))
    }

    const { setActiveNetwork } = useNetwork()
    await setActiveNetwork(NetworkId.MAINNET)
    await nextTick()

    expect(wrapper.get('[data-testid="activeNetwork"]').text()).toBe(NetworkId.MAINNET)
  })

  it('provides updateAlgodConfig function', () => {
    const { updateAlgodConfig } = useNetwork()
    expect(typeof updateAlgodConfig).toBe('function')
  })

  it('calls updateAlgodConfig on the manager when updating network config', () => {
    const networkId = NetworkId.TESTNET
    const config = {
      token: 'new-token',
      baseServer: 'https://new-server.com',
      port: '443'
    }

    const mockUpdateAlgodConfig = vi.fn()
    mockWalletManager.updateAlgodConfig = mockUpdateAlgodConfig

    const { updateAlgodConfig } = useNetwork()
    updateAlgodConfig(networkId, config)

    expect(mockUpdateAlgodConfig).toHaveBeenCalledWith(networkId, config)
  })

  it('provides activeNetworkConfig through useNetwork', async () => {
    const TestComponent = {
      template: `
        <div data-testid="active-network-config">{{ stringifiedConfig }}</div>
      `,
      setup() {
        const { activeNetworkConfig } = useNetwork()
        const stringifiedConfig = computed(() => JSON.stringify(activeNetworkConfig.value))
        return { stringifiedConfig }
      }
    }

    const wrapper = mount(TestComponent)
    await nextTick()

    const actual = JSON.parse(wrapper.get('[data-testid="active-network-config"]').text())
    const expected = mockWalletManager.activeNetworkConfig
    expect(actual).toEqual(expected)
  })

  it('updates activeNetworkConfig when switching networks', async () => {
    const TestComponent = {
      template: `
        <div data-testid="active-network-config">{{ stringifiedConfig }}</div>
      `,
      setup() {
        const { activeNetworkConfig, setActiveNetwork } = useNetwork()
        const stringifiedConfig = computed(() => JSON.stringify(activeNetworkConfig.value))
        return { stringifiedConfig, setActiveNetwork }
      }
    }

    const wrapper = mount(TestComponent)

    const newClient = new algosdk.Algodv2(
      '',
      mockWalletManager.networkConfig[NetworkId.MAINNET].algod.baseServer,
      ''
    )

    mockWalletManager.setActiveNetwork = async (networkId: string) => {
      mockSetAlgodClient(newClient)
      mockStore.setState((state) => ({
        ...state,
        activeNetwork: networkId,
        algodClient: newClient
      }))
    }

    const { setActiveNetwork } = useNetwork()
    await setActiveNetwork(NetworkId.MAINNET)
    await nextTick()

    const actual = JSON.parse(wrapper.get('[data-testid="active-network-config"]').text())
    expect(actual).toEqual(mockWalletManager.networkConfig[NetworkId.MAINNET])
  })

  it('updates activeNetworkConfig when updating network configuration', async () => {
    const TestComponent = {
      template: `
        <div data-testid="active-network-config">{{ stringifiedConfig }}</div>
      `,
      setup() {
        const { activeNetworkConfig, updateAlgodConfig } = useNetwork()
        const stringifiedConfig = computed(() => JSON.stringify(activeNetworkConfig.value))
        return { stringifiedConfig, updateAlgodConfig }
      }
    }

    const wrapper = mount(TestComponent)
    const networkId = NetworkId.TESTNET
    const newConfig = { baseServer: 'https://new-server.com' }

    mockWalletManager.updateAlgodConfig = (id: string, config: Partial<AlgodConfig>) => {
      mockWalletManager.networkConfig[id] = {
        ...mockWalletManager.networkConfig[id],
        algod: {
          ...mockWalletManager.networkConfig[id].algod,
          ...config
        }
      }
      mockStore.setState((state) => ({ ...state }))
    }

    const { updateAlgodConfig } = useNetwork()
    updateAlgodConfig(networkId, newConfig)
    await nextTick()

    const actual = JSON.parse(wrapper.get('[data-testid="active-network-config"]').text())
    expect(actual.algod.baseServer).toBe(newConfig.baseServer)
  })

  it('provides resetNetworkConfig functionality', () => {
    const mockResetNetworkConfig = vi.fn()
    mockWalletManager.resetNetworkConfig = mockResetNetworkConfig

    const { resetNetworkConfig } = useNetwork()
    expect(typeof resetNetworkConfig).toBe('function')

    resetNetworkConfig(NetworkId.TESTNET)
    expect(mockResetNetworkConfig).toHaveBeenCalledWith(NetworkId.TESTNET)
  })

  it('updates algodClient when resetting active network', async () => {
    const TestComponent = {
      template: `
        <div data-testid="algod-client">{{ algodClient }}</div>
      `,
      setup() {
        const { resetNetworkConfig } = useNetwork()
        const { algodClient } = useWallet()
        return { algodClient, resetNetworkConfig }
      }
    }

    const wrapper = mount(TestComponent)
    const newClient = new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/', '')

    // Mock the resetNetworkConfig behavior
    mockWalletManager.resetNetworkConfig = () => {
      mockSetAlgodClient(newClient)
      mockStore.setState((state) => ({ ...state }))
    }

    const { resetNetworkConfig } = useNetwork()
    resetNetworkConfig(NetworkId.TESTNET)
    await nextTick()

    // Parse both JSON strings before comparison
    const actual = JSON.parse(wrapper.get('[data-testid="algod-client"]').text())
    const expected = JSON.parse(JSON.stringify(newClient))
    expect(actual).toEqual(expected)
  })

  it('updates activeNetworkConfig when resetting network configuration', async () => {
    mockStore.setState((state) => ({
      ...state,
      networkConfig: {
        [NetworkId.TESTNET]: {
          ...DEFAULT_NETWORK_CONFIG[NetworkId.TESTNET],
          algod: {
            ...DEFAULT_NETWORK_CONFIG[NetworkId.TESTNET].algod,
            baseServer: 'https://custom-server.com'
          }
        }
      }
    }))

    const TestComponent = {
      template: `
        <div data-testid="active-network-config">{{ stringifiedConfig }}</div>
      `,
      setup() {
        const { activeNetworkConfig, resetNetworkConfig } = useNetwork()
        const stringifiedConfig = computed(() => JSON.stringify(activeNetworkConfig.value))
        return { stringifiedConfig, resetNetworkConfig }
      }
    }

    const wrapper = mount(TestComponent)

    // Mock the resetNetworkConfig behavior
    mockWalletManager.resetNetworkConfig = () => {
      mockWalletManager.networkConfig[NetworkId.TESTNET] = DEFAULT_NETWORK_CONFIG[NetworkId.TESTNET]
      mockStore.setState((state) => ({ ...state }))
    }

    const { resetNetworkConfig } = useNetwork()
    resetNetworkConfig(NetworkId.TESTNET)
    await nextTick()

    const actual = JSON.parse(wrapper.get('[data-testid="active-network-config"]').text())
    expect(actual).toEqual(DEFAULT_NETWORK_CONFIG[NetworkId.TESTNET])
  })
})
