import { PROVIDER_ID } from '../types'
import { useWalletStore } from '../store/index'

const clearActiveAccount = useWalletStore.getState().clearActiveAccount
const removeAccounts = useWalletStore.getState().removeAccounts

export const clearAccounts = (id: PROVIDER_ID) => {
  clearActiveAccount(id)
  removeAccounts(id)
}
