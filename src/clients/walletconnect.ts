/**
 * Helpful resources:
 * https://developer.algorand.org/docs/get-details/walletconnect/
 */
import type _algosdk from "algosdk";
import Algod from "../algod";
import type WalletConnect from "@walletconnect/client";
import { providers } from "../providers";
import type { WalletProvider, Wallet } from "../types/wallet";
import { PROVIDER_ID, NODE_NETWORK } from "../constants";
import BaseWallet from "./base";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";
import { TransactionsArray } from "../types/api";
import type { DecodedTransaction, DecodedSignedTransaction } from "../types";

type WalletConnectTransaction = {
  txn: string;
  message?: string;
  // if the transaction does not need to be signed,
  // because it is part of an atomic group that will be signed by another party,
  // specify an empty signers array
  signers?: string[] | [];
};

type InitWallet = {
  id: PROVIDER_ID;
  client: WalletConnect;
  provider: WalletProvider;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
};

class WalletConnectClient extends BaseWallet {
  #client: WalletConnect;
  id: PROVIDER_ID;
  provider: WalletProvider;

  constructor({ client, id, provider, algosdk, algodClient }: InitWallet) {
    super(algosdk, algodClient);

    this.#client = client;
    this.id = id;
    this.provider = provider;
  }

  static async init() {
    const { algosdk, algodClient } = await Algod.init();
    const WalletConnect = (await import("@walletconnect/client")).default;
    const QRCodeModal = (await import("algorand-walletconnect-qrcode-modal"))
      .default;

    const walletConnect = new WalletConnect({
      bridge: "https://bridge.walletconnect.org",
      qrcodeModal: QRCodeModal,
    });

    const initWallet: InitWallet = {
      id: PROVIDER_ID.WALLET_CONNECT,
      client: walletConnect,
      provider: providers[PROVIDER_ID.WALLET_CONNECT],
      algosdk: algosdk,
      algodClient: algodClient,
    };

    return new WalletConnectClient(initWallet);
  }

  async connect(): Promise<Wallet> {
    let chainId = 416001;

    if (NODE_NETWORK === "betanet") {
      chainId = 416003;
    } else if (NODE_NETWORK === "testnet") {
      chainId = 416002;
    }

    if (!this.#client.connected) {
      await this.#client.createSession({ chainId });
    }

    return new Promise((resolve, reject) => {
      this.#client.on("connect", (error, payload) => {
        if (error) {
          reject(error);
        }

        const { accounts } = payload.params[0];

        resolve({
          ...this.provider,
          accounts: accounts.map((address: string, index: number) => ({
            name: `Wallet Connect ${index + 1}`,
            address,
            providerId: this.provider.id,
          })),
        });
      });

      this.#client.on("session_update", (error, payload) => {
        if (error) {
          reject(error);
        }

        const { accounts } = payload.params[0];

        resolve({
          ...this.provider,
          accounts: accounts.map((address: string, index: number) => ({
            name: `Wallet Connect ${index + 1}`,
            address,
            providerId: this.provider.id,
          })),
        });
      });
    });
  }

  async reconnect() {
    this.#client = (await WalletConnectClient.init()).#client;

    const accounts = this.#client.accounts;

    if (!accounts) {
      return null;
    }

    return {
      ...this.provider,
      accounts: accounts.map((address: string, index: number) => ({
        name: `Wallet Connect ${index + 1}`,
        address,
        providerId: this.provider.id,
      })),
    };
  }

  check() {
    return this.#client.connected;
  }

  async disconnect() {
    try {
      await this.#client.killSession();
    } catch (e) {
      console.error("Error disconnecting", e);
    }
  }

  formatTransactionsArray(
    transactions: TransactionsArray
  ): WalletConnectTransaction[] {
    const formattedTransactions = transactions.map((txn) => {
      const formattedTxn: WalletConnectTransaction = {
        txn: txn[1],
      };

      if (txn[0] === "s") {
        const decodedTxn = this.algosdk.decodeSignedTransaction(
          new Uint8Array(Buffer.from(txn[1], "base64"))
        );

        formattedTxn.txn = Buffer.from(
          this.algosdk.encodeUnsignedTransaction(decodedTxn.txn)
        ).toString("base64");

        formattedTxn.signers = [];
      }

      return formattedTxn;
    });

    return formattedTransactions;
  }

  async signTransactions(activeAdress: string, transactions: Uint8Array[]) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<WalletConnectTransaction[]>(
      (acc, txn, i) => {
        if (
          !("txn" in txn) &&
          this.algosdk.encodeAddress(txn["snd"]) === activeAdress
        ) {
          acc.push({
            txn: Buffer.from(transactions[i]).toString("base64"),
          });
        } else {
          acc.push({
            txn: Buffer.from(transactions[i]).toString("base64"),
            signers: [],
          });
        }

        return acc;
      },
      []
    );

    const requestParams = [txnsToSign];
    const request = formatJsonRpcRequest("algo_signTxn", requestParams);

    // Play an audio file to keep Wallet Connect's web socket open on iOS
    // when the user goes into background mode.
    this.keepWCAliveStart();

    // Sign them with the client.
    const result: Array<string | null> = await this.#client.sendCustomRequest(
      request
    );

    this.keepWCAliveStop();

    // Join the newly signed transactions with the original group of transactions.
    const signedTxns = result.reduce((signedTxns: Uint8Array[], txn, i) => {
      if (txn) {
        signedTxns.push(new Uint8Array(Buffer.from(txn, "base64")));
      }

      if (txn === null) {
        signedTxns.push(transactions[i]);
      }

      return signedTxns;
    }, []);

    return signedTxns;
  }

  async signEncodedTransactions(transactions: TransactionsArray) {
    const transactionsToSign = this.formatTransactionsArray(transactions);
    const requestParams = [transactionsToSign];
    const request = formatJsonRpcRequest("algo_signTxn", requestParams);

    this.keepWCAliveStart();

    const result: Array<string | null> = await this.#client.sendCustomRequest(
      request
    );

    this.keepWCAliveStop();

    const signedRawTransactions = result.reduce(
      (signedTxns: Uint8Array[], txn, currentIndex) => {
        if (txn) {
          signedTxns.push(new Uint8Array(Buffer.from(txn, "base64")));
        }

        if (txn === null) {
          signedTxns.push(
            new Uint8Array(Buffer.from(transactions[currentIndex][1], "base64"))
          );
        }

        return signedTxns;
      },
      []
    );

    return signedRawTransactions;
  }
}

export default WalletConnectClient;
