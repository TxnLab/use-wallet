/**
 * @jest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-empty-function */
import { renderHook, waitFor } from '@testing-library/react'
import useInitializeProviders from './useInitializeProviders'
import { PROVIDER_ID } from '../constants'
import { initializeProviders, reconnectProviders } from '../utils'

jest.mock('../utils')

describe('useInitializeProviders', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    // Mock initializeProviders and reconnectProviders
    ;(initializeProviders as jest.Mock).mockImplementation(() => Promise.resolve({}))
    ;(reconnectProviders as jest.Mock).mockImplementation(() => Promise.resolve())

    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy.mockRestore()
  })

  it('should call initializeProviders and reconnectProviders correctly', async () => {
    renderHook(() =>
      useInitializeProviders({
        providers: [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY],
        nodeConfig: {
          nodeServer: 'http://localhost',
          network: 'testnet'
        }
      })
    )

    await waitFor(() =>
      expect(initializeProviders).toHaveBeenCalledWith(
        [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY],
        {
          nodeServer: 'http://localhost',
          network: 'testnet'
        },
        undefined
      )
    )

    await waitFor(() => expect(reconnectProviders).toHaveBeenCalledWith({}))
  })

  it('should handle errors during initialization correctly', async () => {
    ;(initializeProviders as jest.Mock).mockImplementation(() => {
      throw new Error('Initialization Error')
    })

    renderHook(() => useInitializeProviders())

    await waitFor(() =>
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error initializing wallet providers:',
        new Error('Initialization Error')
      )
    )
    consoleErrorSpy.mockRestore()
  })

  it('should not throw an error if unmounted during initialization', async () => {
    const { unmount } = renderHook(() =>
      useInitializeProviders({
        providers: [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY],
        nodeConfig: {
          nodeServer: 'http://localhost',
          network: 'testnet'
        }
      })
    )

    unmount()

    await waitFor(() => {
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  it('should return the result of initializeProviders', async () => {
    const mockWalletProviders = { pera: {}, defly: {} }
    ;(initializeProviders as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockWalletProviders)
    )

    const { result } = renderHook(() => useInitializeProviders())

    await waitFor(() => expect(result.current).toEqual(mockWalletProviders))
  })
})
