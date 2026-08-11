'use client'

import { WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { defly } from '@txnlab/use-wallet-defly'
import { exodus } from '@txnlab/use-wallet-exodus'
import { kibisis } from '@txnlab/use-wallet-kibisis'
import { kmd } from '@txnlab/use-wallet-kmd'
import { lute } from '@txnlab/use-wallet-lute'
import { mnemonic } from '@txnlab/use-wallet-mnemonic'
import { pera } from '@txnlab/use-wallet-pera'
import { w3wallet } from '@txnlab/use-wallet-w3wallet'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'
import { web3auth } from '@txnlab/use-wallet-web3auth'

const WC_PROJECT_ID = 'fcfde0713d43baa0d23be0773c80a72b'

const wallets = [
  pera(),
  lute(),
  defly(),
  exodus(),
  walletConnect({ projectId: WC_PROJECT_ID }),
  walletConnect({ projectId: WC_PROJECT_ID, skin: 'biatec' }),
  kibisis(),
  w3wallet(),
  kmd(),
  mnemonic(),
  ...(process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID
    ? [web3auth({ clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID })]
    : [])
]

const walletManager = new WalletManager({
  wallets,
  defaultNetwork: 'testnet'
})

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletProvider manager={walletManager}>{children}</WalletProvider>
}
