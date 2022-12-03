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
import { PROVIDER_ID } from "../../constants";
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
    client,
    algosdk,
    algodClient,
    network,
  }: PeraWalletClientConstructor) {
    super(algosdk, algodClient);
    this.#client = client;
    this.network = network;
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
    network,
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
    this.keepWCAliveStart();

    const accounts = await this.#client.connect();

    this.keepWCAliveStop();

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
    transactions: Uint8Array[]
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<PeraTransaction[]>((acc, txn, i) => {
      if (
        !("txn" in txn) &&
        connectedAccounts.includes(this.algosdk.encodeAddress(txn["snd"]))
      ) {
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]),
        });
      } else {
        acc.push({
          txn: this.algosdk.decodeSignedTransaction(transactions[i]).txn,
          signers: [],
        });
      }

      return acc;
    }, []);

    // Play an audio file to keep Wallet Connect's web socket open on iOS
    // when the user goes into background mode.
    this.keepWCAliveStart();

    // Sign them with the client.
    const result = await this.#client.signTransaction([txnsToSign]);

    this.keepWCAliveStop();

    // Join the newly signed transactions with the original group of transactions.
    const signedTxns = decodedTxns.reduce<Uint8Array[]>((acc, txn, i) => {
      if (!("txn" in txn)) {
        const signedByUser = result.shift();
        signedByUser && acc.push(signedByUser);
      } else {
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

    this.keepWCAliveStart();

    const result = (await this.#client.signTransaction([
      transactionsToSign,
    ])) as Uint8Array[];

    this.keepWCAliveStop();

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
