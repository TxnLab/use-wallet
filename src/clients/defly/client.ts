/**
 * Helpful resources:
 * https://github.com/blockshake-io/defly-connect
 */
import type _algosdk from "algosdk";
import Algod, { getAlgodClient } from "../../algod";
import type { Wallet } from "../../types";
import { DEFAULT_NETWORK, PROVIDER_ID } from "../../constants";
import BaseWallet from "../base";
import { TransactionsArray } from "../../types";
import type { DeflyWalletConnect } from "@blockshake/defly-connect";
import type {
  DecodedTransaction,
  DecodedSignedTransaction,
  Network,
} from "../../types";
import { ICON } from "./constants";
import {
  DeflyTransaction,
  InitParams,
  DeflyWalletClientConstructor,
} from "./types";

class DeflyWalletClient extends BaseWallet {
  #client: DeflyWalletConnect;
  network: Network;

  constructor({
    metadata,
    client,
    algosdk,
    algodClient,
    network,
  }: DeflyWalletClientConstructor) {
    super(metadata, algosdk, algodClient);
    this.#client = client;
    this.network = network;
    this.metadata = DeflyWalletClient.metadata;
  }

  static metadata = {
    id: PROVIDER_ID.DEFLY,
    name: "Defly",
    icon: ICON,
    isWalletConnect: true,
  };

  static async init({
    clientOptions,
    algodOptions,
    clientStatic,
    algosdkStatic,
    network = DEFAULT_NETWORK,
  }: InitParams) {
    try {
      const DeflyWalletConnect =
        clientStatic ||
        (await import("@blockshake/defly-connect")).DeflyWalletConnect;

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk;
      const algodClient = await getAlgodClient(algosdk, algodOptions);

      const deflyWallet = new DeflyWalletConnect({
        ...(clientOptions ? clientOptions : { shouldShowSignTxnToast: false }),
      });

      return new DeflyWalletClient({
        metadata: DeflyWalletClient.metadata,
        client: deflyWallet,
        algosdk,
        algodClient,
        network,
      });
    } catch (e) {
      console.error("Error initializing...", e);
      return null;
    }
  }

  async connect(onDisconnect: () => void): Promise<Wallet> {
    const accounts = await this.#client.connect().catch(console.info);

    this.#client.connector?.on("disconnect", onDisconnect);

    if (!accounts || accounts.length === 0) {
      throw new Error(`No accounts found for ${DeflyWalletClient.metadata.id}`);
    }

    const mappedAccounts = accounts.map((address: string, index: number) => ({
      name: `Defly Wallet ${index + 1}`,
      address,
      providerId: DeflyWalletClient.metadata.id,
    }));

    return {
      ...DeflyWalletClient.metadata,
      accounts: mappedAccounts,
    };
  }

  async reconnect(onDisconnect: () => void) {
    const accounts = await this.#client.reconnectSession().catch(console.info);
    this.#client.connector?.on("disconnect", onDisconnect);

    if (!accounts) {
      return null;
    }

    return {
      ...DeflyWalletClient.metadata,
      accounts: accounts.map((address: string, index: number) => ({
        name: `Defly Wallet ${index + 1}`,
        address,
        providerId: DeflyWalletClient.metadata.id,
      })),
    };
  }

  async disconnect() {
    await this.#client.disconnect();
  }

  async signTransactions(
    connectedAccounts: string[],
    transactions: Uint8Array[],
    indexesToSign?: number[],
    returnGroup = true
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    const signedIndexes: number[] = [];

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<DeflyTransaction[]>((acc, txn, i) => {
      const isSigned = "txn" in txn;

      // If the indexes to be signed is specified, designate that it should be signed
      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i);
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]),
        });
        // If the transaction is unsigned and is to be sent from a connected account,
        // designate that it should be signed
      } else if (
        !isSigned &&
        connectedAccounts.includes(this.algosdk.encodeAddress(txn["snd"]))
      ) {
        signedIndexes.push(i);
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]),
        });
        // Otherwise, designate that it should not be signed
      } else if (isSigned) {
        acc.push({
          txn: this.algosdk.decodeSignedTransaction(transactions[i]).txn,
          signers: [],
        });
      } else if (!isSigned) {
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]),
          signers: [],
        });
      }

      return acc;
    }, []);

    // Sign them with the client.
    const result = await this.#client.signTransaction([txnsToSign]);

    // Join the newly signed transactions with the original group of transactions
    // if 'returnGroup' param is specified
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = result.shift();
        signedByUser && acc.push(signedByUser);
      } else if (returnGroup) {
        acc.push(transactions[i]);
      }

      return acc;
    }, []);

    return signedTxns;
  }

  /** @deprecated */
  async signEncodedTransactions(transactions: TransactionsArray) {
    const transactionsToSign = this.formatTransactionsArray(transactions);
    const result: Uint8Array[] = await this.#client.signTransaction([
      transactionsToSign,
    ]);

    const signedTransactions: Uint8Array[] = [];

    let resultIndex = 0;

    for (const [type, txn] of transactions) {
      if (type === "u") {
        signedTransactions.push(result[resultIndex]);
        resultIndex++;
      } else {
        signedTransactions.push(new Uint8Array(Buffer.from(txn, "base64")));
      }
    }

    return signedTransactions;
  }

  /** @deprecated */
  formatTransactionsArray(transactions: TransactionsArray) {
    const formattedTransactions: DeflyTransaction[] = [];

    for (const [type, txn] of transactions) {
      if (type === "s") {
        formattedTransactions.push({
          ...this.algosdk.decodeSignedTransaction(
            new Uint8Array(Buffer.from(txn, "base64"))
          ),
          signers: [],
        });
      } else {
        formattedTransactions.push({
          txn: this.algosdk.decodeUnsignedTransaction(
            new Uint8Array(Buffer.from(txn, "base64"))
          ),
        });
      }
    }

    return formattedTransactions;
  }
}

export default DeflyWalletClient;
