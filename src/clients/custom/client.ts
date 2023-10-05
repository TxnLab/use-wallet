import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import { ICON } from './constants'
import type _algosdk from 'algosdk'
import type { AlgodClientOptions, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import type { Metadata, Wallet } from '../../types/wallet'
import type { CustomProvider, CustomWalletClientConstructor } from './types'

class CustomWalletClient extends BaseClient {
  network: Network
  providerProxy: CustomProvider

  static metadata: Metadata = {
    id: PROVIDER_ID.CUSTOM,
    icon: ICON,
    isWalletConnect: false,
    name: 'Custom'
  }

  constructor({
    providerProxy,
    metadata,
    algosdk,
    algodClient,
    network
  }: CustomWalletClientConstructor) {
    super(metadata, algosdk, algodClient)

    this.providerProxy = providerProxy
    this.network = network
  }

  static async init({
    clientOptions,
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.CUSTOM>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.CUSTOM.toUpperCase() as string} initializing...`)

      if (!clientOptions) {
        throw new Error(`Attempt to create custom wallet with no provider specified.`)
      }

      const algosdk: typeof _algosdk =
        algosdkStatic || (await Algod.init(algodOptions as AlgodClientOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions as AlgodClientOptions)

      try {
        return new CustomWalletClient({
          providerProxy: clientOptions.getProvider({
            algod: algodClient,
            algosdkStatic: algosdk,
            network
          }),
          metadata: {
            ...CustomWalletClient.metadata,
            name: clientOptions.name,
            icon: clientOptions.icon ?? CustomWalletClient.metadata.icon
          },
          algodClient,
          algosdk,
          network
        })
      } finally {
        debugLog(`${PROVIDER_ID.CUSTOM.toUpperCase() as string} initialized`, '✅')
      }
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect(): Promise<Wallet> {
    return await this.providerProxy.connect(this.metadata)
  }

  async disconnect() {
    await this.providerProxy.disconnect()
  }

  async reconnect(): Promise<Wallet | null> {
    return await this.providerProxy.reconnect(this.metadata)
  }

  async signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ) {
    return await this.providerProxy.signTransactions(
      connectedAccounts,
      txnGroups,
      indexesToSign,
      returnGroup
    )
  }
}

export default CustomWalletClient
