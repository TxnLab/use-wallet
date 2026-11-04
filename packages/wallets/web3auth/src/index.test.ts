import { WalletManager } from '@txnlab/use-wallet'
import { web3auth, Web3AuthAdapter, WALLET_ID } from './index'

describe('web3auth factory', () => {
  const clientId = 'test-client-id'

  it('returns default id and metadata', () => {
    const config = web3auth({ clientId })

    expect(config.id).toBe(WALLET_ID)
    expect(config.metadata).toEqual(Web3AuthAdapter.defaultMetadata)
    expect(config.options).toEqual({ clientId })
  })

  it.each(['mainnet', 'testnet', 'localnet'])('is available on %s', (network) => {
    const manager = new WalletManager({
      wallets: [web3auth({ clientId })],
      defaultNetwork: network
    })

    expect(manager.availableWallets.map((w) => w.id)).toEqual([WALLET_ID])
  })
})
