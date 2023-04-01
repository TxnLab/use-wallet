import React, { useState, useEffect } from 'react'
import {
  reconnectProviders,
  initializeProviders,
  WalletProvider,
  SupportedProviders
} from '../../index'
import Account from './Account'
import Connect from './Connect'
import Transact from './Transact'

export default function ConnectWallet() {
  const [walletProviders, setWalletProviders] = useState<SupportedProviders | null>(null)

  useEffect(() => {
    async function initializeAndConnect() {
      const providers = await initializeProviders()
      setWalletProviders(providers)
      reconnectProviders(providers)
    }

    initializeAndConnect()
  }, [])

  return (
    <WalletProvider value={walletProviders}>
      <Account />
      <hr />
      <Connect />
      <hr />
      <Transact />
    </WalletProvider>
  )
}
