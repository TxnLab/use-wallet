import { useState, useMemo, useContext, useEffect } from "react";
import type algosdk from "algosdk";
import { getAlgosdk } from "../algod";
import { useHydratedWalletStore, walletStoreSelector } from "../store/index";
import {
  PROVIDER_ID,
  TransactionsArray,
  WalletClient,
  Provider,
} from "../types";
import { ClientContext } from "../store/state/clientStore";
import allClients from "../clients";
import { clearAccounts } from "../utils/clearAccounts";
import shallow from "zustand/shallow";

export { PROVIDER_ID };

export default function useWallet() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const clients = useContext(ClientContext);

  const {
    activeAccount,
    accounts: connectedAccounts,
    setActiveAccount: _setActiveAccount,
    addAccounts,
  } = useHydratedWalletStore(walletStoreSelector, shallow);

  const getAccountsByProvider = (id: PROVIDER_ID) => {
    return connectedAccounts.filter((account) => account.providerId === id);
  };

  const connectedActiveAccounts = useMemo(
    () =>
      connectedAccounts.filter(
        (account) => account.providerId === activeAccount?.providerId
      ),
    [connectedAccounts, activeAccount]
  );

  useEffect(() => {
    if (!clients) {
      setProviders(null);
      return;
    }

    const supportedClients = Object.keys(clients) as PROVIDER_ID[];

    setProviders(
      supportedClients.map((id) => {
        return {
          ...allClients[id],
          accounts: getAccountsByProvider(id),
          isActive: activeAccount?.providerId === id,
          isConnected: connectedAccounts.some(
            (accounts) => accounts.providerId === id
          ),
          connect: () => connect(id),
          disconnect: () => disconnect(id),
          reconnect: () => reconnect(id),
          setActiveProvider: () => setActive(id),
          setActiveAccount: (account: string) =>
            selectActiveAccount(id, account),
        };
      })
    );
  }, [clients, connectedAccounts, connectedActiveAccounts, activeAccount]);

  const getClient = async (id?: PROVIDER_ID): Promise<WalletClient> => {
    if (!id) throw new Error("Provier ID is missing.");

    const client = await clients?.[id];

    if (!client) throw new Error("Client not found for ID");

    return client;
  };

  const status = useMemo(() => {
    if (activeAccount === undefined) {
      return "initializing";
    }

    if (activeAccount === null && connectedAccounts.length) {
      return "connected";
    }

    if (activeAccount === null && !connectedAccounts.length) {
      return "disconnected";
    }

    if (activeAccount && activeAccount.address) {
      return "active";
    }

    return "error";
  }, [activeAccount]);

  const isActive = useMemo(() => {
    return status === "active";
  }, [status]);

  const isReady = useMemo(() => {
    return status !== "initializing";
  }, [status]);

  const selectActiveAccount = async (
    providerId: PROVIDER_ID,
    address: string
  ) => {
    try {
      const account = connectedActiveAccounts.find(
        (acct) => acct.address === address && acct.providerId === providerId
      );

      if (!account) {
        throw new Error(`No accounts with address ${address} found.`);
      }

      _setActiveAccount(account);
    } catch (e) {
      console.error(e);
    }
  };

  const connect = async (id: PROVIDER_ID) => {
    try {
      const walletClient = await getClient(id);
      const walletInfo = await walletClient?.connect(() => clearAccounts(id));

      if (!walletInfo || !walletInfo.accounts.length) {
        throw new Error("Failed to connect " + id);
      }

      _setActiveAccount(walletInfo.accounts[0]);
      addAccounts(walletInfo.accounts);
    } catch (e) {
      console.error(e);
    }
  };

  const reconnect = async (id: PROVIDER_ID) => {
    try {
      const walletClient = await getClient(id);
      const walletInfo = await walletClient?.reconnect(() => clearAccounts(id));

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
      const walletClient = await getClient(id);

      walletClient?.disconnect();
    } catch (e) {
      console.error(e);
    } finally {
      clearAccounts(id);
    }
  };

  const setActive = async (id: PROVIDER_ID) => {
    try {
      const accounts = getAccountsByProvider(id);
      _setActiveAccount(accounts[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const signTransactions = async (
    transactions: Array<Uint8Array>,
    indexesToSign?: number[],
    returnGroup = true
  ) => {
    const walletClient = await getClient(activeAccount?.providerId);

    if (!walletClient || !activeAccount?.address) {
      throw new Error("No wallet found.");
    }

    const signedTransactions = await walletClient.signTransactions(
      connectedActiveAccounts.map((acct) => acct.address),
      transactions,
      indexesToSign,
      returnGroup
    );

    return signedTransactions;
  };

  const sendTransactions = async (
    transactions: Uint8Array[],
    waitRoundsToConfirm?: number
  ) => {
    const walletClient = await getClient(activeAccount?.providerId);

    const result = await walletClient?.sendRawTransactions(
      transactions,
      waitRoundsToConfirm
    );

    return result;
  };

  const signer: algosdk.TransactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ) => {
    const algosdk = await getAlgosdk();
    const txnBlobs: Array<Uint8Array> = txnGroup.map(
      algosdk.encodeUnsignedTransaction
    );

    return await Promise.resolve(
      signTransactions(txnBlobs, indexesToSign, false)
    );
  };

  const getAccountInfo = async () => {
    if (!activeAccount) throw new Error("No selected account.");

    const walletClient = await getClient(activeAccount.providerId);

    const accountInfo = await walletClient?.getAccountInfo(
      activeAccount.address
    );

    return accountInfo;
  };

  const getAddress = () => {
    return activeAccount?.address;
  };

  const getAssets = async () => {
    if (!activeAccount) throw new Error("No selected account.");

    const walletClient = await getClient(activeAccount.providerId);

    return await walletClient?.getAssets(activeAccount.address);
  };

  const groupTransactionsBySender = async (transactions: TransactionsArray) => {
    const walletClient = await getClient(activeAccount?.providerId);

    return walletClient?.groupTransactionsBySender(transactions);
  };

  return {
    clients,
    providers,
    connectedAccounts,
    connectedActiveAccounts,
    activeAccount,
    activeAddress: activeAccount?.address,
    status,
    isActive,
    isReady,
    signer,
    signTransactions,
    sendTransactions,
    getAddress,
    groupTransactionsBySender,
    getAccountInfo,
    getAssets,
  };
}
