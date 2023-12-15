import React, { createContext, useContext } from 'react'
import type { SupportedProviders } from '../types/providers'

const WalletContext = createContext<SupportedProviders | null>(null)

export const useWalletContext = (): SupportedProviders | null => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within the WalletProvider')
  }
  return context
}

export interface WalletProviderProps {
  children: React.ReactNode
  value: SupportedProviders | null
}

export const WalletProvider = ({ children, value }: WalletProviderProps) => {
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
