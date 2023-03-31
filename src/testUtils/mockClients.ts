/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { PeraWalletConnect } from '@perawallet/connect'
import DeflyWalletClient from '../clients/defly/client'
import PeraWalletClient from '../clients/pera/client'
import { PROVIDER_ID } from '../constants'
import { deflyAccounts, peraAccounts } from '../hooks/useWallet.test'

export const createPeraMockInstance = (): PeraWalletClient => {
  const mockPeraWalletClient = new PeraWalletClient({
    metadata: {
      id: PROVIDER_ID.PERA,
      name: 'Pera',
      icon: 'pera-icon-b64',
      isWalletConnect: true
    },
    client: new (PeraWalletConnect as any)(),
    algosdk: {} as any,
    algodClient: {
      accountInformation: () => ({
        do: () => Promise.resolve({})
      })
    } as any,
    network: 'test-network'
  })

  // Mock the connect method
  mockPeraWalletClient.connect = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...mockPeraWalletClient.metadata,
      accounts: peraAccounts
    })
  )

  // Mock the disconnect method
  mockPeraWalletClient.disconnect = jest.fn().mockImplementation(() => Promise.resolve())

  return mockPeraWalletClient
}

export const createDeflyMockInstance = (): DeflyWalletClient => {
  const mockDeflyWalletClient = new DeflyWalletClient({
    metadata: {
      id: PROVIDER_ID.DEFLY,
      name: 'Defly',
      icon: 'defly-icon-b64',
      isWalletConnect: true
    },
    client: new (DeflyWalletConnect as any)(),
    algosdk: {} as any,
    algodClient: {
      accountInformation: () => ({
        do: () => Promise.resolve({})
      })
    } as any,
    network: 'test-network'
  })

  // Mock the connect method
  mockDeflyWalletClient.connect = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ...mockDeflyWalletClient.metadata,
      accounts: deflyAccounts
    })
  )

  // Mock the disconnect method
  mockDeflyWalletClient.disconnect = jest.fn().mockImplementation(() => Promise.resolve())

  return mockDeflyWalletClient
}
