/* eslint-disable @typescript-eslint/no-empty-function */
import { getActiveProviders, isActiveProvider } from './providers'
import { useWalletStore } from '../store'
import { PROVIDER_ID } from '../constants'

jest.spyOn(useWalletStore, 'getState').mockImplementation(() => {
  return {
    accounts: [
      { address: 'addr1', providerId: PROVIDER_ID.PERA, name: 'Pera 1' },
      { address: 'addr2', providerId: PROVIDER_ID.PERA, name: 'Pera 2' },
      { address: 'addr3', providerId: PROVIDER_ID.DEFLY, name: 'Defly 1' }
    ],
    activeAccount: undefined,
    setActiveAccount: () => {},
    clearActiveAccount: () => {},
    addAccounts: () => {},
    removeAccounts: () => {}
  }
})

describe('getActiveProviders', () => {
  it('should return a list of unique active providers', () => {
    const result = getActiveProviders()

    expect(result).toHaveLength(2)
    expect(result).toContain(PROVIDER_ID.PERA)
    expect(result).toContain(PROVIDER_ID.DEFLY)
  })
})

describe('isActiveProvider', () => {
  it('should return true if the provider is active', () => {
    expect(isActiveProvider(PROVIDER_ID.PERA)).toBeTruthy()
    expect(isActiveProvider(PROVIDER_ID.DEFLY)).toBeTruthy()
  })

  it('should return false if the provider is not active', () => {
    expect(isActiveProvider(PROVIDER_ID.KMD)).toBeFalsy()
    expect(isActiveProvider(PROVIDER_ID.MNEMONIC)).toBeFalsy()
  })
})
