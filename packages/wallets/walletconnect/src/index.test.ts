import { walletConnect, WalletConnectAdapter, WALLET_ID } from './index'
import { BUILTIN_SKINS } from './skins'

describe('walletConnect factory', () => {
  const projectId = 'test-project-id'

  it('returns default id and metadata without a skin', () => {
    const config = walletConnect({ projectId })

    expect(config.id).toBe(WALLET_ID)
    expect(config.metadata).toEqual(WalletConnectAdapter.defaultMetadata)
    expect(config.options).toEqual({ projectId })
  })

  it('uses skin id and metadata when a built-in skin is set', () => {
    const config = walletConnect({ projectId, skin: 'biatec' })

    expect(config.id).toBe('walletconnect:biatec')
    expect(config.metadata).toEqual({
      name: BUILTIN_SKINS.biatec.name,
      icon: BUILTIN_SKINS.biatec.icon
    })
  })

  it('uses a custom skin object to override display metadata', () => {
    const skin = { id: 'mywallet', name: 'My Wallet', icon: 'data:custom-icon' }
    const config = walletConnect({ projectId, skin })

    expect(config.id).toBe('walletconnect:mywallet')
    expect(config.metadata).toEqual({ name: 'My Wallet', icon: 'data:custom-icon' })
  })

  it('passes WalletConnect dApp metadata through to adapter options', () => {
    const metadata = {
      name: 'My dApp',
      description: 'My dApp description',
      url: 'https://example.com',
      icons: ['https://example.com/icon.png']
    }
    const config = walletConnect({ projectId, metadata })

    expect(config.options).toEqual({ projectId, metadata })
    expect(config.metadata).toEqual(WalletConnectAdapter.defaultMetadata)
  })
})
