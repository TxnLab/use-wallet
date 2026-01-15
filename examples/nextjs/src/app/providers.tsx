'use client'

import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
  type SupportedWallet
} from '@txnlab/use-wallet-react'

const wallets: SupportedWallet[] = [
  WalletId.DEFLY,
  WalletId.DEFLY_WEB,
  WalletId.EXODUS,
  WalletId.PERA,
  {
    id: WalletId.WALLETCONNECT,
    options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
  },
  {
    id: WalletId.BIATEC,
    options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
  },
  WalletId.KMD,
  WalletId.KIBISIS,
  WalletId.LUTE,
  {
    id: WalletId.MAGIC,
    options: { apiKey: 'pk_live_D17FD8D89621B5F3' }
  },
  WalletId.MNEMONIC,
  WalletId.W3_WALLET
]

// Add Web3Auth if client ID is configured
if (process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID) {
  wallets.push({
    id: WalletId.WEB3AUTH,
    options: {
      clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
      ...(process.env.NEXT_PUBLIC_WEB3AUTH_VERIFIER && {
        verifier: process.env.NEXT_PUBLIC_WEB3AUTH_VERIFIER
      })
    }
  })
}

const walletManager = new WalletManager({
  wallets,
  defaultNetwork: NetworkId.TESTNET
})

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletProvider manager={walletManager}>{children}</WalletProvider>
}
