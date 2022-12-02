import { useMemo, useContext } from "react";
import type algosdk from "algosdk";
import { getAlgosdk } from "../algod";
import { useWalletStore, walletStoreSelector } from "../store/index";
import { PROVIDER_ID, TransactionsArray, WalletClient } from "../types";
import { ClientContext } from "../store/state/clientStore";
import allClients from "../clients";
import shallow from "zustand/shallow";
import {
  DEFAULT_NODE_BASEURL,
  DEFAULT_NODE_TOKEN,
  DEFAULT_NODE_PORT,
} from "../constants";

type SupportedProviders = { [x: string]: Promise<WalletClient | null> };

export const initializeProviders = (
  providers?: PROVIDER_ID[],
  nodeServer = DEFAULT_NODE_BASEURL,
  nodeToken = DEFAULT_NODE_TOKEN,
  nodePort = DEFAULT_NODE_PORT
) => {
  const initializedProviders: SupportedProviders = {};

  if (!providers || providers.length === 0)
    for (const [id, client] of Object.entries(allClients)) {
      if (id === "kmd") {
        continue;
      }

      initializedProviders[id] = client.init({
        algodOptions: [nodeToken, nodeServer, nodePort],
      });
    }

  if (providers) {
    for (const id of providers) {
      initializedProviders[id] = allClients[id].init({
        algodOptions: [nodeToken, nodeServer, nodePort],
      });
    }
  }

  return initializedProviders;
};

export const reconnectProviders = async (providers: SupportedProviders) => {
  const clients = Object.values(providers);

  for (const client of clients) {
    client.then((c) => {
      c?.reconnect(c?.disconnect);
    });
  }
};

export { PROVIDER_ID };

export default function useWallet() {
  const clients = useContext(ClientContext);

  const {
    selectedAccount,
    accounts: connectedAccounts,
    setActiveAccount: setActiveAccount,
    clearActiveAccount,
    addAccounts,
    removeAccounts,
  } = useWalletStore(walletStoreSelector, shallow);

  const activeAccounts = useMemo(
    () =>
      connectedAccounts.filter(
        (account) => account.providerId === selectedAccount?.providerId
      ),
    [connectedAccounts, selectedAccount]
  );

  const providers = useMemo(() => {
    if (!clients) return null;

    const supportedClients = Object.keys(clients) as PROVIDER_ID[];

    return supportedClients.map((id) => {
      return {
        ...allClients[id],
        accounts: activeAccounts,
        selectedAccount,
        isActive: selectedAccount?.providerId === id,
        isConnected: connectedAccounts.some(
          (accounts) => accounts.providerId === id
        ),
        connect: () => connect(id),
        disconnect: () => disconnect(id),
        reconnect: () => reconnect(id),
        setActive: () => setActive(id),
        selectAccount: (account: string) => selectActiveAccount(id, account),
      };
    });
  }, [clients, connectedAccounts, activeAccounts, selectedAccount]);

  const getClient = async (id?: PROVIDER_ID) => {
    if (!id) throw new Error("Provier ID is missing.");

    const client = clients?.[id];

    if (!client) throw new Error("Client not found for ID");

    return client;
  };

  const disconnectWCSessions = async (id: PROVIDER_ID) => {
    if (!allClients[id].metadata.isWalletConnect) {
      return;
    }

    if (!providers) {
      return;
    }

    const wcSessions = Object.values(providers).filter(
      (p) =>
        p.metadata.id !== id &&
        p.metadata.isWalletConnect &&
        (p.isConnected || p.isActive)
    );

    for (const session of wcSessions) {
      await disconnect(session.metadata.id);
    }
  };

  const getAccountsByProvider = (id: PROVIDER_ID) => {
    return connectedAccounts.filter((account) => account.providerId === id);
  };

  const selectActiveAccount = async (
    providerId: PROVIDER_ID,
    address: string
  ) => {
    try {
      const account = activeAccounts.find(
        (acct) => acct.address === address && acct.providerId === providerId
      );

      if (!account) {
        throw new Error(`No accounts with address ${address} found.`);
      }

      await disconnectWCSessions(account.providerId);
      setActiveAccount(account);
    } catch (e) {
      console.error(e);
    }
  };

  const connect = async (id: PROVIDER_ID) => {
    try {
      await disconnectWCSessions(id);

      const walletClient = await getClient(id);
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

  const reconnect = async (id: PROVIDER_ID) => {
    try {
      const walletClient = await getClient(id);
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
      const walletClient = await getClient(id);

      walletClient?.disconnect();
    } catch (e) {
      console.error(e);
    } finally {
      clearActiveAccount(id);
      removeAccounts(id);
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

  const signTransactions = async (transactions: Array<Uint8Array>) => {
    const walletClient = await getClient(selectedAccount?.providerId);

    if (!walletClient || !selectedAccount?.address) {
      throw new Error("No wallet found.");
    }

    const signedTransactions = await walletClient.signTransactions(
      activeAccounts.map((acct) => acct.address),
      transactions
    );

    return signedTransactions;
  };

  const sendTransactions = async (
    transactions: Uint8Array[],
    waitRoundsToConfirm?: number
  ) => {
    const walletClient = await getClient(selectedAccount?.providerId);

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
    const txns = await Promise.resolve(signTransactions(txnBlobs));
    return txns.filter((_, index) => indexesToSign.includes(index));
  };

  const getAccountInfo = async () => {
    if (!selectedAccount) throw new Error("No selected account.");

    const walletClient = await getClient(selectedAccount.providerId);

    const accountInfo = await walletClient?.getAccountInfo(
      selectedAccount.address
    );

    return accountInfo;
  };

  const getAddress = () => {
    return selectedAccount?.address;
  };

  const getAssets = async () => {
    if (!selectedAccount) throw new Error("No selected account.");

    const walletClient = await getClient(selectedAccount.providerId);

    return await walletClient?.getAssets(selectedAccount.address);
  };

  const groupTransactionsBySender = async (transactions: TransactionsArray) => {
    const walletClient = await getClient(selectedAccount?.providerId);

    return walletClient?.groupTransactionsBySender(transactions);
  };

  const signEncodedTransactions = async (transactions: TransactionsArray) => {
    const walletClient = await getClient(selectedAccount?.providerId);

    return await walletClient?.signEncodedTransactions(transactions);
  };

  const sendRawTransactions = async (
    transactions: Uint8Array[],
    waitRoundsToConfirm?: number
  ) => {
    const walletClient = await getClient(selectedAccount?.providerId);

    return await walletClient?.sendRawTransactions(
      transactions,
      waitRoundsToConfirm
    );
  };

  return {
    clients,
    providers,
    connectedAccounts,
    activeAccounts,
    selectedAccount,
    signer,
    signTransactions,
    sendTransactions,
    getAddress,
    groupTransactionsBySender,
    getAccountInfo,
    getAssets,
    signEncodedTransactions,
    sendRawTransactions,
  };
}
