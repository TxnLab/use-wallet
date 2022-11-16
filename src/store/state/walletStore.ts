import { immer } from "zustand/middleware/immer";
import create from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { Account } from "../../types";
import { PROVIDER_ID } from "../../constants";

export const walletStoreSelector = (state: WalletStore) => ({
  accounts: state.accounts,
  activeAccount: state.activeAccount,
  setActiveAccount: state.setActiveAccount,
  clearActiveAccount: state.clearActiveAccount,
  addAccounts: state.addAccounts,
  removeAccounts: state.removeAccounts,
});

export type WalletStore = {
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (account: Account) => void;
  clearActiveAccount: (id: PROVIDER_ID) => void;
  addAccounts: (accounts: Account[]) => void;
  removeAccounts: (providerId: PROVIDER_ID) => void;
};

export const useWalletStore = create<WalletStore>()(
  immer(
    persist(
      devtools((set, _get) => ({
        accounts: [],
        activeAccount: null,
        setActiveAccount: (account: Account) => {
          set((state) => {
            state.activeAccount = account;
          });
        },
        clearActiveAccount: (id: PROVIDER_ID) => {
          set((state) => {
            if (id === state.activeAccount?.providerId)
              state.activeAccount = null;
          });
        },
        addAccounts: (accounts: Account[]) => {
          set((state) => {
            const uniqueAccounts = [...state.accounts, ...accounts].reduce<
              Account[]
            >((uniqueAccounts, o) => {
              if (
                !uniqueAccounts.some(
                  (obj) =>
                    obj.providerId === o.providerId && obj.address === o.address
                )
              ) {
                uniqueAccounts.push(o);
              }
              return uniqueAccounts;
            }, []);

            // Remove duplicates that occur when a user reconnects Pera wallet
            state.accounts = uniqueAccounts;
          });
        },
        removeAccounts: (providerId: PROVIDER_ID) => {
          set((state) => {
            state.accounts = state.accounts.filter(
              (account) => account.providerId !== providerId
            );
          });
        },
      })),
      {
        name: "txnlab-use-wallet", // key in local storage
        version: 0, // increment to deprecate stored data
      }
    )
  )
);
