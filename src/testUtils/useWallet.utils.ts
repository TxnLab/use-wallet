import { useHydratedWalletStore, WalletStore } from '../store/state/walletStore'

export const mockUseHydratedWalletStore = (mockedState: WalletStore) => {
  ;(useHydratedWalletStore as unknown as jest.Mock).mockImplementation(() => mockedState)
}
