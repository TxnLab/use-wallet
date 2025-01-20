import { Store } from '@tanstack/vue-store'
import {
  NetworkId,
  WalletManager,
  WalletId,
  type AlgodConfig,
  type State
} from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { computed, inject, nextTick, ref, type InjectionKey } from 'vue'
import { useNetwork } from '../useNetwork'
import type { Mock } from 'vitest'

// Mock Vue's inject function
vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  return {
    ...mod,
    inject: vi.fn()
  }
})

// Share the same mock setup
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
    wallets: {}
  })

  mockWalletManager = new WalletManager({
    wallets: [WalletId.DEFLY]
  })

  vi.spyOn(mockWalletManager, 'store', 'get').mockReturnValue(mockStore)
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
    wallets: {}
  }))
  ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
    if (token === 'walletManager') return mockWalletManager
    if (token === 'setAlgodClient') return mockSetAlgodClient
    if (token === 'algodClient') return mockAlgodClient
    return null
  })
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
    const { setActiveNetwork, algodClient } = useNetwork()
    const newClient = new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev', '')

    mockWalletManager.setActiveNetwork = async (networkId: string) => {
      mockSetAlgodClient(newClient)
      mockWalletManager.store.setState((state) => ({
        ...state,
        activeNetwork: networkId,
        algodClient: newClient
      }))
    }

    await setActiveNetwork(NetworkId.MAINNET)
    await nextTick()

    expect(algodClient.value).toStrictEqual(newClient)
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
        const { activeNetwork, algodClient } = useNetwork()
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

  it('provides updateNetworkAlgod function', () => {
    const { updateNetworkAlgod } = useNetwork()
    expect(typeof updateNetworkAlgod).toBe('function')
  })

  it('calls updateNetworkAlgod on the manager when updating network config', () => {
    const networkId = NetworkId.TESTNET
    const config = {
      token: 'new-token',
      baseServer: 'https://new-server.com',
      port: '443'
    }

    const mockUpdateNetworkAlgod = vi.fn()
    mockWalletManager.updateNetworkAlgod = mockUpdateNetworkAlgod

    const { updateNetworkAlgod } = useNetwork()
    updateNetworkAlgod(networkId, config)

    expect(mockUpdateNetworkAlgod).toHaveBeenCalledWith(networkId, config)
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
    // Set up initial network configs
    mockWalletManager.networkConfig = {
      [NetworkId.TESTNET]: {
        algod: { baseServer: 'https://testnet-api.algonode.cloud', token: '' },
        isTestnet: true,
        genesisId: 'testnet-v1.0',
        genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        caipChainId: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
      },
      [NetworkId.MAINNET]: {
        algod: { baseServer: 'https://mainnet-api.algonode.cloud', token: '' },
        isTestnet: false,
        genesisId: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        caipChainId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
      }
    }

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
    mockWalletManager.networkConfig = {
      [NetworkId.TESTNET]: {
        algod: { baseServer: 'https://testnet-api.algonode.cloud', token: '' },
        isTestnet: true,
        genesisId: 'testnet-v1.0',
        genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        caipChainId: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
      }
    }

    const TestComponent = {
      template: `
        <div data-testid="active-network-config">{{ stringifiedConfig }}</div>
      `,
      setup() {
        const { activeNetworkConfig, updateNetworkAlgod } = useNetwork()
        const stringifiedConfig = computed(() => JSON.stringify(activeNetworkConfig.value))
        return { stringifiedConfig, updateNetworkAlgod }
      }
    }

    const wrapper = mount(TestComponent)
    const networkId = NetworkId.TESTNET
    const newConfig = { baseServer: 'https://new-server.com' }

    mockWalletManager.updateNetworkAlgod = (id: string, config: Partial<AlgodConfig>) => {
      mockWalletManager.networkConfig[id] = {
        ...mockWalletManager.networkConfig[id],
        algod: {
          ...mockWalletManager.networkConfig[id].algod,
          ...config
        }
      }
      mockStore.setState((state) => ({ ...state }))
    }

    const { updateNetworkAlgod } = useNetwork()
    updateNetworkAlgod(networkId, newConfig)
    await nextTick()

    const actual = JSON.parse(wrapper.get('[data-testid="active-network-config"]').text())
    expect(actual.algod.baseServer).toBe(newConfig.baseServer)
  })
})
