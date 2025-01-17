import { Store } from '@tanstack/vue-store'
import { NetworkId, WalletManager, WalletId, type State } from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { inject, nextTick, ref, type InjectionKey } from 'vue'
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
})
