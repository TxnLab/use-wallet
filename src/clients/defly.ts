/**
 * Helpful resources:
 * https://github.com/blockshake-io/defly-connect
 */
import { providers } from "../providers";
import { algosdk } from "../algod";
import type { WalletProvider, Wallet } from "../types";
import { PROVIDER_ID } from "../constants";
import type { Transaction } from "algosdk";
import BaseWallet from "./base";
import { TransactionsArray } from "../types";
import { DeflyWalletConnect } from "@blockshake/defly-connect";
import type { DecodedTransaction, DecodedSignedTransaction } from "../types";

const deflyWallet = new DeflyWalletConnect({
  shouldShowSignTxnToast: false,
});

export interface DeflyTransaction {
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
  client: DeflyWalletConnect;
  providers: typeof providers;
};

class DeflyWalletClient extends BaseWallet {
  #client: DeflyWalletConnect;
  id: PROVIDER_ID;
  provider: WalletProvider;

  constructor(initWallet: InitWallet) {
    super();

    this.#client = initWallet.client;
    this.id = initWallet.id;
    this.provider = initWallet.providers[this.id];
  }

  static async init() {
    const initWallet: InitWallet = {
      id: PROVIDER_ID.DEFLY,
      client: deflyWallet,
      providers: providers,
    };

    return new DeflyWalletClient(initWallet);
  }

  async connect(onDisconnect: () => void): Promise<Wallet> {
    const accounts = await this.#client.connect();
    this.#client.connector?.on("disconnect", onDisconnect);

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${this.provider}`);
    }

    const mappedAccounts = accounts.map((address: string, index: number) => ({
      name: `Defly Wallet ${index + 1}`,
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
        name: `Defly Wallet ${index + 1}`,
        address,
        providerId: this.provider.id,
      })),
    };
  }

  async disconnect() {
    await this.#client.disconnect();
  }

  formatTransactionsArray(transactions: TransactionsArray) {
    const formattedTransactions: DeflyTransaction[] = [];

    for (const [type, txn] of transactions) {
      if (type === "s") {
        formattedTransactions.push({
          ...algosdk.decodeSignedTransaction(
            new Uint8Array(Buffer.from(txn, "base64"))
          ),
          signers: [],
        });
      } else {
        formattedTransactions.push({
          txn: algosdk.decodeUnsignedTransaction(
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
      return algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<DeflyTransaction[]>((acc, txn, i) => {
      if (
        !("txn" in txn) &&
        algosdk.encodeAddress(txn["snd"]) === activeAdress
      ) {
        acc.push({
          txn: algosdk.decodeUnsignedTransaction(transactions[i]),
        });
      } else {
        acc.push({
          txn: algosdk.decodeSignedTransaction(transactions[i]).txn,
          signers: [],
        });
      }

      return acc;
    }, []);

    // Sign them with the client.
    const result = await this.#client.signTransaction([txnsToSign]);

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
}

export default DeflyWalletClient;
