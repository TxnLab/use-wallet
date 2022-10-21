import { useMemo } from "react";
import { useWalletStore, walletStoreSelector } from "../store/index";
import type { PROVIDER_ID } from "../types";
import { providers as walletProviders } from "../providers";
import shallow from "zustand/shallow";
import { getWalletClient } from "../utils";

export default function useConnectWallet() {
  const {
    accounts,
    setActiveAccount,
    activeAccount,
    clearActiveAccount,
    addAccounts,
    removeAccounts,
  } = useWalletStore(walletStoreSelector, shallow);

  const providers = useMemo(
    () =>
      Object.values(walletProviders).map(
        ({ id, name, icon, isWalletConnect }) => {
          return {
            id,
            name,
            icon,
            isActive: activeAccount?.providerId === id,
            isConnected: accounts.some(
              (accounts) => accounts.providerId === id
            ),
            isWalletConnect,
            connect: () => connect(id),
            disconnect: () => disconnect(id),
            reconnect: () => reconnect(id),
            setActive: () => setActive(id),
          };
        }
      ),
    [accounts, activeAccount]
  );

  const getAccountsByProvider = (id: PROVIDER_ID) => {
    return accounts.filter((account) => account.providerId === id);
  };

  const reconnectProviders = async () => {
    Object.values(providers).forEach(({ id, isActive, isConnected }) => {
      if (isActive || isConnected) {
        reconnect(id);
      }
    });
  };

  const disconnectWCSessions = async (id: PROVIDER_ID) => {
    if (!walletProviders[id].isWalletConnect) {
      return;
    }

    const wcSessions = Object.values(providers).filter(
      (p) => p.id !== id && p.isWalletConnect && (p.isConnected || p.isActive)
    );

    for (const session of wcSessions) {
      await disconnect(session.id);
    }
  };

  const connect = async (id: PROVIDER_ID) => {
    try {
      await disconnectWCSessions(id);

      const walletClient = await getWalletClient(id);
      const walletInfo = await walletClient.connect(() => disconnect(id));

      if (!walletInfo || !walletInfo.accounts.length) {
        throw new Error("Failed to connect " + id);
      }

      setActiveAccount(walletInfo.accounts[0]);
      addAccounts(walletInfo.accounts);
    } catch (e) {
      console.error(e);
    }
  };

  const setActive = async (id: PROVIDER_ID) => {
    try {
      await disconnectWCSessions(id);
      const accounts = getAccountsByProvider(id);
      setActiveAccount(accounts[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const reconnect = async (id: PROVIDER_ID) => {
    try {
      const walletClient = await getWalletClient(id);
      const walletInfo = await walletClient?.reconnect(() => disconnect(id));

      if (walletInfo && walletInfo.accounts.length) {
        addAccounts(walletInfo.accounts);
      }
    } catch (e) {
      console.error(e);
      disconnect(id);
    }
  };

  const disconnect = async (id: PROVIDER_ID) => {
    try {
      const walletClient = await getWalletClient(id);

      walletClient?.disconnect();
    } catch (e) {
      console.error(e);
    } finally {
      clearActiveAccount(id);
      removeAccounts(id);
    }
  };

  return {
    providers,
    activeAccount,
    accounts,
    connect,
    reconnect,
    disconnect,
    setActive,
    reconnectProviders,
  };
}
