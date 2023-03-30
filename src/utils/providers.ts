import { PROVIDER_ID } from '../constants'
import { useWalletStore } from '../store'

export const getActiveProviders = () => {
  const accounts = useWalletStore.getState().accounts
  return [...new Set(accounts.map((acct) => acct.providerId))]
}

export const isActiveProvider = (id: PROVIDER_ID) => {
  const activeProviders = getActiveProviders()
  return activeProviders.includes(id)
}
