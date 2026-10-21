import { NetworkId, WalletManager, type WalletManagerConfig } from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import { defineComponent, h, inject } from 'vue'
import { useWalletManager } from './useWalletManager'
import { WalletManagerPlugin } from './walletManagerPlugin'

describe('useWalletManager', () => {
  const TestComponent = defineComponent({
    setup() {
      const manager = useWalletManager()
      const injectedManager = inject<WalletManager>('walletManager')
      return { manager, injectedManager }
    },
    render() {
      return h('div')
    }
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the WalletManager installed by the plugin', () => {
    const options: WalletManagerConfig = {
      wallets: [],
      defaultNetwork: NetworkId.TESTNET
    }
    const wrapper = mount(TestComponent, {
      global: {
        plugins: [[WalletManagerPlugin, options]]
      }
    })

    const { manager, injectedManager } = wrapper.vm

    expect(manager).toBeInstanceOf(WalletManager)
    expect(manager).toBe(injectedManager)
  })

  it('throws an error if the WalletManager plugin is not installed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => mount(TestComponent)).toThrow('WalletManager plugin is not properly installed')

    warnSpy.mockRestore()
  })
})
