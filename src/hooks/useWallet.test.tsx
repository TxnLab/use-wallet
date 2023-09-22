/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react'
import React from 'react'
import useWallet from './useWallet'
import DeflyWalletClient from '../clients/defly'
import PeraWalletClient from '../clients/pera'
import { default as ClientProvider } from '../store/state/clientStore'
import { useHydratedWalletStore } from '../store/state/walletStore'
import { createWrapper } from '../testUtils/createWrapper'
import { mockAccounts } from '../testUtils/mockAccounts'
import { createDeflyMockInstance, createPeraMockInstance } from '../testUtils/mockClients'
import { clearAccounts } from '../utils/clearAccounts'
import type { WalletClient } from '../types'
import { PROVIDER_ID } from '../constants'

const peraAccounts = mockAccounts(PROVIDER_ID.PERA, 2)
const deflyAccounts = mockAccounts(PROVIDER_ID.DEFLY, 1)

const setActiveAccountSpy = jest.fn()

// Returned by mocked `useHydratedWalletStore`
const mockedState = {
  accounts: [...peraAccounts, ...deflyAccounts],
  activeAccount: peraAccounts[0],
  setActiveAccount: setActiveAccountSpy,
  clearActiveAccount: jest.fn(),
  addAccounts: jest.fn(),
  removeAccounts: jest.fn()
}

jest.mock('../store/state/walletStore', () => ({
  useHydratedWalletStore: jest.fn()
}))

jest.mock('../', () => ({
  ClientProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('../utils/clearAccounts')

describe('useWallet', () => {
  let peraMockInstance: PeraWalletClient
  let deflyMockInstance: DeflyWalletClient
  let mockClientProviders: Record<string, WalletClient | null>

  beforeEach(() => {
    // Mock `useHydratedWalletStore`
    ;(useHydratedWalletStore as unknown as jest.Mock).mockImplementation(() => mockedState)

    // Mock clients
    peraMockInstance = createPeraMockInstance(undefined, peraAccounts)
    deflyMockInstance = createDeflyMockInstance(undefined, deflyAccounts)

    // Pera client methods
    jest.spyOn(peraMockInstance, 'connect')
    jest.spyOn(peraMockInstance, 'disconnect')
    jest.spyOn(peraMockInstance, 'getAccountInfo')

    // Passed to `ClientProvider` in renderHook wrapper
    mockClientProviders = {
      pera: peraMockInstance,
      defly: deflyMockInstance
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return active and connected accounts', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(ClientProvider, { value: mockClientProviders })
    })

    // Active account
    expect(result.current.activeAccount).toEqual(peraAccounts[0])
    expect(result.current.activeAddress).toBe(mockedState.activeAccount.address)

    // Connected accounts
    expect(result.current.connectedAccounts).toEqual(mockedState.accounts)
    expect(result.current.connectedActiveAccounts).toEqual(peraAccounts)
    expect(result.current.connectedActiveAccounts).not.toContain(deflyAccounts[0])
  })

  it('should return `providers` array', async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(ClientProvider, { value: mockClientProviders })
    })

    const providers = result.current.providers
    expect(providers?.length).toBe(Object.keys(mockClientProviders).length)

    const peraProvider = providers?.[0]
    const deflyProvider = providers?.[1]

    // Active, connected provider (Pera)
    expect(peraProvider?.metadata.id).toBe(PROVIDER_ID.PERA)
    expect(peraProvider?.accounts).toEqual(peraAccounts)
    expect(peraProvider?.isActive).toBe(true)
    expect(peraProvider?.isConnected).toBe(true)

    // Inactive, connected provider (Defly)
    expect(deflyProvider?.metadata.id).toBe(PROVIDER_ID.DEFLY)
    expect(deflyProvider?.accounts).toEqual(deflyAccounts)
    expect(deflyProvider?.isActive).toBe(false)
    expect(deflyProvider?.isConnected).toBe(true)

    // Connect Pera
    await act(async () => await peraProvider?.connect())
    expect(peraMockInstance.connect).toHaveBeenCalled()
    expect(setActiveAccountSpy).toBeCalledWith(peraAccounts[0])

    // Set active account
    peraProvider?.setActiveAccount(peraAccounts[1].address)
    expect(setActiveAccountSpy).toBeCalledWith(peraAccounts[1])

    // Connect Defly
    await act(async () => await deflyProvider?.connect())
    expect(peraMockInstance.connect).toHaveBeenCalled()
    expect(setActiveAccountSpy).toBeCalledWith(deflyAccounts[0])

    // Set active provider
    peraProvider?.setActiveProvider()
    expect(setActiveAccountSpy).toBeCalledWith(peraAccounts[0])

    // Disconnect
    await act(async () => await peraProvider?.disconnect())
    expect(peraMockInstance.disconnect).toHaveBeenCalled()
    expect(clearAccounts).toHaveBeenCalled()
  })

  it('should return status flags', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(ClientProvider, { value: mockClientProviders })
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.isReady).toBe(true)
  })

  it('should return `getAccountInfo`', async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(ClientProvider, { value: mockClientProviders })
    })

    await act(async () => {
      await result.current.getAccountInfo()
    })

    expect(peraMockInstance.getAccountInfo).toHaveBeenCalled()
  })
})
