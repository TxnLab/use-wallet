import { PROVIDER_ID } from '../constants'
import { useWalletStore } from '../store/index'

export const clearAccounts = (id: PROVIDER_ID) => {
  const { clearActiveAccount, removeAccounts } = useWalletStore.getState()

  clearActiveAccount(id)
  removeAccounts(id)
}
