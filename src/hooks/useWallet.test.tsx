/**
 * @jest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-empty-function */
import React from 'react'
import { renderHook } from '@testing-library/react'
import useWallet, { PROVIDER_ID } from './useWallet'
import { WalletClient, WalletProvider } from '../'
import { createWrapper } from '../testUtils/createWrapper'
import { mockUseHydratedWalletStore } from '../testUtils/useWallet.utils'

// Mock the WalletProvider
jest.mock('../', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  WalletClient: jest.fn()
}))

// Mock WalletProvider context value
const mockWalletProviders: Record<string, Promise<WalletClient | null>> = {
  pera: Promise.resolve(null),
  defly: Promise.resolve(null)
}

// Mock the useHydratedWalletStore
jest.mock('../store/state/walletStore', () => ({
  useHydratedWalletStore: jest.fn()
}))

const setActiveAccountSpy = jest.fn()
const clearActiveAccountSpy = jest.fn()
const addAccountsSpy = jest.fn()
const removeAccountsSpy = jest.fn()

const mockedState = {
  accounts: [{ address: 'addr1', providerId: PROVIDER_ID.PERA, name: 'Account 1' }],
  activeAccount: { address: 'addr1', providerId: PROVIDER_ID.PERA, name: 'Account 1' },
  setActiveAccount: setActiveAccountSpy,
  clearActiveAccount: clearActiveAccountSpy,
  addAccounts: addAccountsSpy,
  removeAccounts: removeAccountsSpy
}

describe('useWallet', () => {
  beforeEach(() => {
    // Reset the spies before each test
    setActiveAccountSpy.mockClear()
    clearActiveAccountSpy.mockClear()
    addAccountsSpy.mockClear()
    removeAccountsSpy.mockClear()

    // Set up the mock for useHydratedWalletStore
    mockUseHydratedWalletStore(mockedState)
  })

  it('should return the active and connected accounts if available', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(WalletProvider, { value: mockWalletProviders })
    })

    expect(result.current.activeAccount).toEqual({
      address: mockedState.activeAccount.address,
      providerId: mockedState.activeAccount.providerId,
      name: mockedState.activeAccount.name
    })

    expect(result.current.connectedAccounts).toEqual(mockedState.accounts)
    expect(result.current.connectedActiveAccounts).toEqual([mockedState.activeAccount])

    expect(result.current.isActive).toBe(true)
    expect(result.current.isReady).toBe(true)

    expect(result.current.getAddress()).toBe(mockedState.activeAccount.address)
  })

  it('should return the status', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(WalletProvider, { value: mockWalletProviders })
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.isReady).toBe(true)
  })

  // Add more test cases here
})
