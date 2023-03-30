/* eslint-disable @typescript-eslint/no-empty-function */
import { reconnectProviders } from './reconnectProviders'
import * as providerModule from './providers'
import { PROVIDER_ID } from '../constants'
import type { Wallet, WalletClient } from '../types'

const createMockClient = (
  id: PROVIDER_ID,
  reconnect: (onDisconnect: () => void) => Promise<Wallet | null>
): WalletClient => {
  const client: Partial<WalletClient> = {
    metadata: {
      id,
      name: 'mock-name',
      icon: 'mock-icon',
      isWalletConnect: false
    },
    reconnect
  }

  return client as WalletClient
}

describe('reconnectProviders', () => {
  let isActiveProviderSpy: jest.SpyInstance<boolean, [PROVIDER_ID]>

  beforeEach(() => {
    jest.clearAllMocks()
    isActiveProviderSpy = jest.spyOn(providerModule, 'isActiveProvider')
  })

  afterEach(() => {
    isActiveProviderSpy.mockRestore()
  })

  it('should only call reconnect on active providers', async () => {
    const reconnectPeraSpy = jest.fn()
    const reconnectDeflySpy = jest.fn()
    const reconnectKmdSpy = jest.fn()

    const providers = {
      pera: Promise.resolve(createMockClient(PROVIDER_ID.PERA, reconnectPeraSpy)),
      defly: Promise.resolve(createMockClient(PROVIDER_ID.DEFLY, reconnectDeflySpy)),
      kmd: Promise.resolve(createMockClient(PROVIDER_ID.KMD, reconnectKmdSpy))
    }

    // Mock `isActiveProvider` to return true for Pera and Defly only
    isActiveProviderSpy.mockImplementation((id) => {
      return id === PROVIDER_ID.PERA || id === PROVIDER_ID.DEFLY
    })

    await reconnectProviders(providers)

    expect(reconnectPeraSpy).toHaveBeenCalled()
    expect(reconnectDeflySpy).toHaveBeenCalled()
    expect(reconnectKmdSpy).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const error = new Error('Test error')
    const reconnectSpy = jest.fn(() => {
      throw error
    })

    const providers = {
      pera: Promise.resolve(createMockClient(PROVIDER_ID.PERA, reconnectSpy))
    }

    isActiveProviderSpy.mockImplementation((id) => id === PROVIDER_ID.PERA)

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await reconnectProviders(providers)

    expect(reconnectSpy).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(error)

    consoleErrorSpy.mockRestore()
  })
})
