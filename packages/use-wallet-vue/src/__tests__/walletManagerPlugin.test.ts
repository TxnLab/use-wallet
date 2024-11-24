import { defineComponent, h, inject } from 'vue'
import { WalletManagerPlugin } from '../walletManagerPlugin'
import { NetworkId, WalletManager, type WalletManagerConfig } from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { mount } from '@vue/test-utils'
import type { SetAlgodClient } from '../useWallet'

const mockAlgodClient = new algosdk.Algodv2('mock-token', 'https://mock-server', '')

vi.mock('@txnlab/use-wallet', async (importOriginal) => {
  const module = await importOriginal<typeof import('@txnlab/use-wallet')>()
  return {
    ...module,
    WalletManager: vi.fn().mockImplementation(() => ({
      algodClient: mockAlgodClient,
      resumeSessions: vi.fn().mockResolvedValue(undefined)
    }))
  }
})

describe('WalletManagerPlugin', () => {
  const TestComponent = defineComponent({
    setup() {
      const walletManager = inject<WalletManager>('walletManager')
      const algodClient = inject<algosdk.Algodv2>('algodClient')
      const setAlgodClient = inject<SetAlgodClient>('setAlgodClient')
      return { walletManager, algodClient, setAlgodClient }
    },
    render() {
      return h('div')
    }
  })

  it('provides walletManager, algodClient, and setAlgodClient', () => {
    const options: WalletManagerConfig = {
      wallets: [],
      defaultNetwork: NetworkId.TESTNET
    }
    const wrapper = mount(TestComponent, {
      global: {
        plugins: [[WalletManagerPlugin, options]]
      }
    })

    const { walletManager, algodClient, setAlgodClient } = wrapper.vm

    expect(walletManager).toBeDefined()
    expect(algodClient).toBeDefined()
    expect(setAlgodClient).toBeDefined()
  })

  it('initializes with the correct algodClient', () => {
    const options: WalletManagerConfig = {
      wallets: [],
      defaultNetwork: NetworkId.TESTNET
    }
    const wrapper = mount(TestComponent, {
      global: {
        plugins: [[WalletManagerPlugin, options]]
      }
    })

    const { algodClient } = wrapper.vm

    expect(algodClient).toStrictEqual(mockAlgodClient)
  })

  it('setAlgodClient updates the reactive algodClient and manager.algodClient', () => {
    const options: WalletManagerConfig = {
      wallets: [],
      defaultNetwork: NetworkId.TESTNET
    }
    const newAlgodClient = new algosdk.Algodv2('mock-token', 'https://mock-server', '')

    const wrapper = mount(TestComponent, {
      global: {
        plugins: [[WalletManagerPlugin, options]]
      }
    })

    const { algodClient, setAlgodClient, walletManager } = wrapper.vm

    expect(algodClient).toStrictEqual(mockAlgodClient)

    setAlgodClient?.(newAlgodClient)

    expect(algodClient).toStrictEqual(newAlgodClient)
    expect(walletManager?.algodClient).toStrictEqual(newAlgodClient)
  })

  it('calls resumeSessions on the walletManager', () => {
    const options: WalletManagerConfig = {
      wallets: [],
      defaultNetwork: NetworkId.TESTNET
    }

    const wrapper = mount(TestComponent, {
      global: {
        plugins: [[WalletManagerPlugin, options]]
      }
    })

    const { walletManager } = wrapper.vm

    expect(walletManager?.resumeSessions).toHaveBeenCalled()
  })
})
