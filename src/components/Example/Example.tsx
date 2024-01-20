import React from 'react'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { DaffiWalletConnect } from '@daffiwallet/connect'
import LuteConnect from 'lute-connect'
import { WalletProvider, PROVIDER_ID, useInitializeProviders, Network } from '../../index'
import Account from './Account'
import Connect from './Connect'
import Transact from './Transact'
import algosdk from 'algosdk'
import { ManualGoalSigningAlertPromptProvider } from './TestManualProvider'

const DUMMY_MAGIC_PK = 'pk_live_D17FD8D89621B5F3'
const getDynamicPeraWalletConnect = async () => {
  const PeraWalletConnect = (await import('@perawallet/connect')).PeraWalletConnect
  return PeraWalletConnect
}

const getDynamigMagic = async () => {
  const Magic = (await import('magic-sdk')).Magic
  return Magic
}

export default function ConnectWallet() {
  const walletProviders = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
      { id: PROVIDER_ID.PERA, getDynamicClient: getDynamicPeraWalletConnect },
      { id: PROVIDER_ID.DAFFI, clientStatic: DaffiWalletConnect },
      { id: PROVIDER_ID.EXODUS },
      { id: PROVIDER_ID.LUTE, clientStatic: LuteConnect, clientOptions: { siteName: 'Storybook' } },
      {
        id: PROVIDER_ID.MAGIC,
        getDynamicClient: getDynamigMagic,
        clientOptions: { apiKey: DUMMY_MAGIC_PK }
      },
      {
        id: PROVIDER_ID.CUSTOM,
        clientOptions: {
          name: 'Manual',
          getProvider: (params: {
            network?: Network
            algod?: algosdk.Algodv2
            algosdkStatic?: typeof algosdk
          }) => {
            return new ManualGoalSigningAlertPromptProvider(params.algosdkStatic ?? algosdk)
          }
        }
      }
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
