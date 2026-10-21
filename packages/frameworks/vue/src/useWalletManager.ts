import type { WalletManager } from '@txnlab/use-wallet'
import { inject } from 'vue'

export function useWalletManager(): WalletManager {
  const manager = inject<WalletManager>('walletManager')

  if (!manager) {
    throw new Error('WalletManager plugin is not properly installed')
  }

  return manager
}
