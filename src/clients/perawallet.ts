/**
 * Helpful resources:
 * https://github.com/perawallet/connect
 */
import { providers } from "../providers";
import type { PeraWalletConnect } from "@perawallet/connect";
import type { WalletProvider, Wallet } from "../types";
import { PROVIDER_ID, NODE_TOKEN, NODE_SERVER, NODE_PORT } from "../constants";
import type { Transaction } from "algosdk";
import BaseWallet from "./base";
import type { InitAlgodClient } from "./base";
import { TransactionsArray } from "../types";
import type { DecodedTransaction, DecodedSignedTransaction } from "../types";

export interface PeraTransaction {
  txn: Transaction;
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[];
}

type InitWallet = {
  id: PROVIDER_ID;
  client: PeraWalletConnect;
  providers: typeof providers;
};

class PeraWalletClient extends BaseWallet {
  #client: PeraWalletConnect;
  id: PROVIDER_ID;
  provider: WalletProvider;

  constructor(initAlgodClient: InitAlgodClient, initWallet: InitWallet) {
    super(initAlgodClient);

    this.#client = initWallet.client;
    this.id = initWallet.id;
    this.provider = initWallet.providers[this.id];
  }

  static async init() {
    const algosdk = (await import("algosdk")).default;

    const initAlgodClient: InitAlgodClient = {
      algosdk,
      token: NODE_TOKEN,
      server: NODE_SERVER,
      port: NODE_PORT,
    };

    const PeraWalletConnect = (await import("@perawallet/connect"))
      .PeraWalletConnect;
    const peraWallet = new PeraWalletConnect({ shouldShowSignTxnToast: false });

    const initWallet: InitWallet = {
      id: PROVIDER_ID.PERA_WALLET,
      client: peraWallet,
      providers: providers,
    };

    return new PeraWalletClient(initAlgodClient, initWallet);
  }

  async connect(onDisconnect: () => void): Promise<Wallet> {
    this.keepWCAliveStart();

    const accounts = await this.#client.connect();

    this.keepWCAliveStop();

    this.#client.connector?.on("disconnect", onDisconnect);

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${this.provider}`);
    }

    const mappedAccounts = accounts.map((address: string, index: number) => ({
      name: `Pera Wallet ${index + 1}`,
      address,
      providerId: this.provider.id,
    }));

    return {
      ...this.provider,
      accounts: mappedAccounts,
    };
  }

  async reconnect(onDisconnect: () => void) {
    const accounts = await this.#client.reconnectSession();
    this.#client.connector?.on("disconnect", onDisconnect);

    if (!accounts) {
      return null;
    }

    return {
      ...this.provider,
      accounts: accounts.map((address: string, index: number) => ({
        name: `Pera Wallet ${index + 1}`,
        address,
        providerId: this.provider.id,
      })),
    };
  }

  async disconnect() {
    await this.#client.disconnect();
  }

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

  async signTransactions(activeAdress: string, transactions: Uint8Array[]) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<PeraTransaction[]>((acc, txn, i) => {
      if (
        !("txn" in txn) &&
        this.algosdk.encodeAddress(txn["snd"]) === activeAdress
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

export default PeraWalletClient.init().catch((e) => {
  if (typeof window !== "undefined") {
    console.error("error initializing PeraWalletClient", e);
    return;
  }
});
