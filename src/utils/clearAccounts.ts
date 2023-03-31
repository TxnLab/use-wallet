import { PROVIDER_ID } from '../types'
import { useWalletStore } from '../store/index'

export const clearAccounts = (id: PROVIDER_ID) => {
  const { clearActiveAccount, removeAccounts } = useWalletStore.getState()

  clearActiveAccount(id)
  removeAccounts(id)
}
