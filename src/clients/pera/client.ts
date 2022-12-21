/**
 * Helpful resources:
 * https://github.com/perawallet/connect
 */
import type _algosdk from "algosdk";
import Algod, { getAlgodClient } from "../../algod";
import type { PeraWalletConnect } from "@perawallet/connect";
import type {
  Wallet,
  TransactionsArray,
  DecodedTransaction,
  DecodedSignedTransaction,
  Network,
} from "../../types";
import { PROVIDER_ID, DEFAULT_NETWORK } from "../../constants";
import BaseWallet from "../base";
import { ICON } from "./constants";
import {
  PeraTransaction,
  PeraWalletClientConstructor,
  InitParams,
} from "./types";

class PeraWalletClient extends BaseWallet {
  #client: PeraWalletConnect;
  network: Network;

  constructor({
    metadata,
    client,
    algosdk,
    algodClient,
    network,
  }: PeraWalletClientConstructor) {
    super(metadata, algosdk, algodClient);
    this.#client = client;
    this.network = network;
    this.metadata = PeraWalletClient.metadata;
  }

  static metadata = {
    id: PROVIDER_ID.PERA,
    name: "Pera",
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
      const PeraWalletConnect =
        clientStatic || (await import("@perawallet/connect")).PeraWalletConnect;

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk;
      const algodClient = await getAlgodClient(algosdk, algodOptions);

      const peraWallet = new PeraWalletConnect({
        ...(clientOptions ? clientOptions : { shouldShowSignTxnToast: false }),
      });

      return new PeraWalletClient({
        metadata: PeraWalletClient.metadata,
        client: peraWallet,
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
    const accounts = await this.#client.connect();

    this.#client.connector?.on("disconnect", onDisconnect);

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${PeraWalletClient.metadata.id}`);
    }

    const mappedAccounts = accounts.map((address: string, index: number) => ({
      name: `Pera Wallet ${index + 1}`,
      address,
      providerId: PeraWalletClient.metadata.id,
    }));

    return {
      ...PeraWalletClient.metadata,
      accounts: mappedAccounts,
    };
  }

  async reconnect(onDisconnect: () => void) {
    const accounts = await this.#client.reconnectSession().catch(console.info);

    this.#client.connector?.on("disconnect", onDisconnect);

    if (!accounts) {
      onDisconnect();
      return null;
    }

    return {
      ...PeraWalletClient.metadata,
      accounts: accounts.map((address: string, index: number) => ({
        name: `Pera Wallet ${index + 1}`,
        address,
        providerId: PeraWalletClient.metadata.id,
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
    const txnsToSign = decodedTxns.reduce<PeraTransaction[]>((acc, txn, i) => {
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

    // Join the newly signed transactions with the original group of transactions.
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
  formatTransactionsArray(transactions: TransactionsArray): PeraTransaction[] {
    const formattedTransactions: PeraTransaction[] = [];

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

  /** @deprecated */
  async signEncodedTransactions(transactions: TransactionsArray) {
    const transactionsToSign = this.formatTransactionsArray(transactions);

    const result = (await this.#client.signTransaction([
      transactionsToSign,
    ])) as Uint8Array[];

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
}

export default PeraWalletClient;
