import { Account, PROVIDER_ID } from 'src/types'

export const mockAccounts = (providerId: PROVIDER_ID, qty = 1): Account[] => {
  const accounts = []

  for (let i = 0; i < qty; i++) {
    accounts.push({
      address: `mock-address-${providerId}-${i}`,
      name: `mock-name-${providerId}-${i}`,
      providerId
    })
  }

  return accounts
}
