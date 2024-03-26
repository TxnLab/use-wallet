'use client'

import { WalletManager } from '@txnlab/use-wallet-js'
import * as React from 'react'

const WalletContext = React.createContext<WalletManager | undefined>(undefined)

export const useWalletManager = () => {
  const manager = React.useContext(WalletContext)

  if (!manager) {
    throw new Error('useWallet must be used within the WalletProvider')
  }

  return manager
}

interface WalletProviderProps {
  manager: WalletManager
  children: React.ReactNode
}

export const WalletProvider = ({ manager, children }: WalletProviderProps): JSX.Element => {
  React.useEffect(() => {
    const resumeSessions = async () => {
      try {
        await manager.resumeSessions()
      } catch (error) {
        console.error('Error resuming sessions:', error)
      }
    }

    resumeSessions()
  }, [manager])

  return <WalletContext.Provider value={manager}>{children}</WalletContext.Provider>
}
