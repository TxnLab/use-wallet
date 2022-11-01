/**
 * Helpful resources:
 * https://docs.exodus.com/api-reference/algorand-provider-api/
 */
import type _algosdk from "algosdk";
import BaseWallet from "./base";
import Algod from "../algod";
import { PROVIDER_ID } from "../constants";
import { providers } from "../providers";
import type { WalletProvider } from "../types";
import { TransactionsArray } from "../types";
import type { DecodedTransaction, DecodedSignedTransaction } from "../types";

type WindowExtended = { exodus: { algorand: Exodus } } & Window &
  typeof globalThis;

type Bytes = Readonly<Uint8Array>;

type Exodus = {
  isConnected: boolean;
  address: string | null;
  connect: () => Promise<{
    address: string;
  }>;
  disconnect: () => void;
  signAndSendTransaction(transactions: Bytes[]): Promise<{
    txId: string;
  }>;
  signTransaction(transactions: Bytes[]): Promise<Bytes[]>;
};

type InitWallet = {
  client: Exodus;
  id: PROVIDER_ID;
  provider: WalletProvider;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
};

class ExodusClient extends BaseWallet {
  #client: Exodus;
  id: PROVIDER_ID;
  provider: WalletProvider;

  constructor({ client, id, provider, algosdk, algodClient }: InitWallet) {
    super(algosdk, algodClient);

    this.#client = client;
    this.id = id;
    this.provider = provider;
  }

  static async init() {
    if (
      typeof window == "undefined" ||
      (window as WindowExtended).exodus === undefined
    ) {
      throw new Error("Exodus is not available.");
    }

    const { algosdk, algodClient } = await Algod.init();
    const exodus = (window as WindowExtended).exodus.algorand as Exodus;

    return new ExodusClient({
      id: PROVIDER_ID.EXODUS,
      client: exodus,
      provider: providers[PROVIDER_ID.EXODUS],
      algosdk: algosdk,
      algodClient: algodClient,
    });
  }

  async connect() {
    const { address } = await this.#client.connect();

    if (!address) {
      throw new Error(`No accounts found for ${this.provider}`);
    }

    const accounts = [
      {
        name: `Exodus 1`,
        address,
        providerId: this.provider.id,
      },
    ];

    return {
      ...this.provider,
      accounts,
    };
  }

  async reconnect(onDisconnect: () => void) {
    if (
      window === undefined ||
      (window as WindowExtended).exodus === undefined ||
      (window as WindowExtended).exodus.algorand.isConnected !== true
    ) {
      onDisconnect();
    }

    return null;
  }

  async disconnect() {
    return;
  }

  async signTransactions(
    activeAdress: string,
    transactions: Array<Uint8Array>
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    // Get the unsigned transactions.
    const txnsToSign = decodedTxns.reduce<Uint8Array[]>((acc, txn, i) => {
      // If the transaction isn't already signed and is to be sent from a connected account,
      // add it to the arrays of transactions to be signed.
      if (
        !("txn" in txn) &&
        this.algosdk.encodeAddress(txn["snd"]) === activeAdress
      ) {
        acc.push(transactions[i]);
      }

      return acc;
    }, []);

    // Sign them with the client.
    const result = await this.#client.signTransaction(txnsToSign);

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
    const transactionsToSign: Uint8Array[] = [];
    const signedRawTransactions: Uint8Array[] = [];

    for (const [type, txn] of transactions) {
      if (type === "u") {
        const decoded = this.algosdk.decodeUnsignedTransaction(
          Buffer.from(txn, "base64")
        );
        transactionsToSign.push(decoded.toByte());
      }
    }

    const result = await this.#client.signTransaction(transactionsToSign);

    if (!result) {
      throw new Error("Signing failed.");
    }

    let resultIndex = 0;

    for (const [type, txn] of transactions) {
      if (type === "u") {
        signedRawTransactions.push(result[resultIndex]);
        resultIndex++;
      } else {
        signedRawTransactions.push(new Uint8Array(Buffer.from(txn, "base64")));
      }
    }

    return signedRawTransactions;
  }
}

export default ExodusClient;
