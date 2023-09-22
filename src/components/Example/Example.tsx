import React from 'react'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { DaffiWalletConnect } from '@daffiwallet/connect'
import { WalletProvider, PROVIDER_ID, useInitializeProviders } from '../../index'
import Account from './Account'
import Connect from './Connect'
import Transact from './Transact'

const getDynamicPeraWalletConnect = async () => {
  const PeraWalletConnect = (await import('@perawallet/connect')).PeraWalletConnect
  return PeraWalletConnect
}

export default function ConnectWallet() {
  const walletProviders = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
      { id: PROVIDER_ID.PERA, getDynamicClient: getDynamicPeraWalletConnect },
      { id: PROVIDER_ID.DAFFI, clientStatic: DaffiWalletConnect },
      { id: PROVIDER_ID.EXODUS }
    ]
  })

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
