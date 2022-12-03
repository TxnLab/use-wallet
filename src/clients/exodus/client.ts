/**
 * Helpful resources:
 * https://docs.exodus.com/api-reference/algorand-provider-api/
 */
import type _algosdk from "algosdk";
import BaseWallet from "../base";
import Algod, { getAlgodClient } from "../../algod";
import { DEFAULT_NETWORK, PROVIDER_ID } from "../../constants";
import type {
  TransactionsArray,
  DecodedTransaction,
  DecodedSignedTransaction,
  Network,
} from "../../types";
import { ICON } from "./constants";
import {
  InitParams,
  WindowExtended,
  Exodus,
  ExodusClientConstructor,
} from "./types";

class ExodusClient extends BaseWallet {
  #client: Exodus;
  #onlyIfTrusted: boolean;
  network: Network;

  constructor({
    client,
    algosdk,
    algodClient,
    onlyIfTrusted,
    network,
  }: ExodusClientConstructor) {
    super(algosdk, algodClient);
    this.#client = client;
    this.#onlyIfTrusted = onlyIfTrusted;
    this.network = network;
  }

  static metadata = {
    id: PROVIDER_ID.EXODUS,
    name: "Exodus",
    icon: ICON,
    isWalletConnect: false,
  };

  static async init({
    clientOptions,
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK,
  }: InitParams) {
    try {
      if (
        typeof window == "undefined" ||
        (window as WindowExtended).exodus === undefined
      ) {
        throw new Error("Exodus is not available.");
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk;
      const algodClient = await getAlgodClient(algosdk, algodOptions);
      const exodus = (window as WindowExtended).exodus.algorand as Exodus;

      return new ExodusClient({
        id: PROVIDER_ID.EXODUS,
        client: exodus,
        algosdk: algosdk,
        algodClient: algodClient,
        onlyIfTrusted: clientOptions?.onlyIfTrusted || false,
        network,
      });
    } catch (e) {
      console.error("Error initializing...", e);
      return null;
    }
  }

  async connect() {
    const { address } = await this.#client.connect({
      onlyIfTrusted: this.#onlyIfTrusted,
    });

    if (!address) {
      throw new Error(`No accounts found for ${ExodusClient.metadata.id}`);
    }

    const accounts = [
      {
        name: `Exodus 1`,
        address,
        providerId: ExodusClient.metadata.id,
      },
    ];

    return {
      ...ExodusClient.metadata,
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
    connectedAccounts: string[],
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
