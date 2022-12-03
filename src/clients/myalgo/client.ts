/**
 * Helpful resources:
 * https://github.com/randlabs/myalgo-connect
 */
import BaseWallet from "../base";
import type _MyAlgoConnect from "@randlabs/myalgo-connect";
import type _algosdk from "algosdk";
import Algod, { getAlgodClient } from "../../algod";
import { PROVIDER_ID } from "../../constants";
import {
  TransactionsArray,
  DecodedTransaction,
  DecodedSignedTransaction,
  Network,
} from "../../types";
import { MyAlgoWalletClientConstructor, InitParams } from "./types";
import { ICON } from "./constants";

class MyAlgoWalletClient extends BaseWallet {
  #client: _MyAlgoConnect;
  network: Network;

  constructor({
    client,
    algosdk,
    algodClient,
    network,
  }: MyAlgoWalletClientConstructor) {
    super(algosdk, algodClient);
    this.#client = client;
    this.network = network;
  }

  static metadata = {
    id: PROVIDER_ID.MYALGO,
    name: "MyAlgo",
    icon: ICON,
    isWalletConnect: false,
  };

  static async init({
    clientOptions,
    algodOptions,
    clientStatic,
    algosdkStatic,
    network,
  }: InitParams) {
    try {
      const MyAlgoConnect =
        clientStatic || (await import("@randlabs/myalgo-connect")).default;

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk;
      const algodClient = await getAlgodClient(algosdk, algodOptions);

      const myAlgo = new MyAlgoConnect({
        ...(clientOptions ? clientOptions : { disableLedgerNano: false }),
      });

      return new MyAlgoWalletClient({
        client: myAlgo,
        algosdk: algosdk,
        algodClient: algodClient,
        network,
      });
    } catch (e) {
      console.error("Error initializing...", e);
      return null;
    }
  }

  async connect() {
    const accounts = await this.#client.connect();

    if (accounts.length === 0) {
      throw new Error(
        `No accounts found for ${MyAlgoWalletClient.metadata.id}`
      );
    }

    const mappedAccounts = accounts.map((account) => ({
      ...account,
      providerId: MyAlgoWalletClient.metadata.id,
    }));

    return {
      ...MyAlgoWalletClient.metadata,
      accounts: mappedAccounts,
    };
  }

  async reconnect() {
    return null;
  }

  async disconnect() {
    return;
  }

  async signTransactions(
    connectedAccounts: string[],
    transactions: Uint8Array[]
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
        connectedAccounts.includes(this.algosdk.encodeAddress(txn["snd"]))
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
        const signedByUser = result.shift()?.blob;
        signedByUser && acc.push(signedByUser);
      } else {
        acc.push(transactions[i]);
      }

      return acc;
    }, []);

    return signedTxns;
  }

  /** @deprecated */
  async signEncodedTransactions(transactions: TransactionsArray) {
    const transactionsToSign: string[] = [];
    const signedRawTransactions: Uint8Array[] = [];

    for (const [type, txn] of transactions) {
      if (type === "u") {
        transactionsToSign.push(txn);
      }
    }

    const result = await this.#client.signTransaction(transactionsToSign);

    if (!result) {
      throw new Error("Signing failed.");
    }

    let resultIndex = 0;

    for (const [type, txn] of transactions) {
      if (type === "u") {
        signedRawTransactions.push(result[resultIndex].blob);
        resultIndex++;
      } else {
        signedRawTransactions.push(new Uint8Array(Buffer.from(txn, "base64")));
      }
    }

    return signedRawTransactions;
  }
}

export default MyAlgoWalletClient;
