import { useState, useEffect } from "react";
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
  activeAccount: Account | null | undefined;
  setActiveAccount: (account: Account) => void;
  clearActiveAccount: (id: PROVIDER_ID) => void;
  addAccounts: (accounts: Account[]) => void;
  removeAccounts: (providerId: PROVIDER_ID) => void;
};

const emptyState: WalletStore = {
  accounts: [],
  activeAccount: undefined,
  setActiveAccount: (account: Account) => {},
  clearActiveAccount: (id: PROVIDER_ID) => {},
  addAccounts: (accounts: Account[]) => {},
  removeAccounts: (providerId: PROVIDER_ID) => {},
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
        version: 1, // increment to deprecate stored data
      }
    )
  )
);

// This a fix to ensure zustand never hydrates the store before React hydrates the page
// otherwise it causes a mismatch between SSR and client render
// see: https://github.com/pmndrs/zustand/issues/1145
export const useHydratedWalletStore = ((selector, compare) => {
  const store = useWalletStore(selector, compare);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return hydrated ? store : selector(emptyState);
}) as typeof useWalletStore;
