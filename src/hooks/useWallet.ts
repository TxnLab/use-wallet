import { useMemo } from "react";
import type algosdk from "algosdk";
import { getAlgosdk } from "../algod";
import { useWalletStore } from "../store/index";
import { PROVIDER_ID } from "../types";
import { getWalletClient } from "../utils";
import { TransactionsArray } from "../types";

export { PROVIDER_ID };

export default function useWallet() {
  const allAccounts = useWalletStore((state) => state.accounts);
  const activeAccount = useWalletStore((state) => state.activeAccount);

  const accounts = useMemo(
    () =>
      allAccounts.filter(
        (account) => account.providerId === activeAccount?.providerId
      ),
    [allAccounts, activeAccount]
  );

  const signTransactions = async (transactions: Array<Uint8Array>) => {
    const walletClient = await getWalletClient(activeAccount?.providerId);

    if (!walletClient || !activeAccount?.address) {
      throw new Error("No wallet found.");
    }

    const signedTransactions = await walletClient.signTransactions(
      activeAccount.address,
      transactions
    );

    return signedTransactions;
  };

  const sendTransactions = async (
    transactions: Uint8Array[],
    waitRoundsToConfirm?: number
  ) => {
    const walletClient = await getWalletClient(activeAccount?.providerId);

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
    if (!activeAccount) throw new Error("No selected account.");

    const walletClient = await getWalletClient(activeAccount.providerId);

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

    const walletClient = await getWalletClient(activeAccount.providerId);

    return await walletClient?.getAssets(activeAccount.address);
  };

  const groupTransactionsBySender = async (transactions: TransactionsArray) => {
    const walletClient = await getWalletClient(activeAccount?.providerId);

    return walletClient?.groupTransactionsBySender(transactions);
  };

  const signEncodedTransactions = async (transactions: TransactionsArray) => {
    const walletClient = await getWalletClient(activeAccount?.providerId);

    return await walletClient?.signEncodedTransactions(transactions);
  };

  const sendRawTransactions = async (
    transactions: Uint8Array[],
    waitRoundsToConfirm?: number
  ) => {
    const walletClient = await getWalletClient(activeAccount?.providerId);

    return await walletClient?.sendRawTransactions(
      transactions,
      waitRoundsToConfirm
    );
  };

  return {
    accounts,
    activeAccount,
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
