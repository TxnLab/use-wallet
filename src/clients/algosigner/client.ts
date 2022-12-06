/**
 * Helpful resources:
 * https://github.com/PureStake/algosigner/blob/develop/docs/dApp-integration.md
 */
import type _algosdk from "algosdk";
import BaseWallet from "../base";
import Algod, { getAlgodClient } from "../../algod";
import { PROVIDER_ID, DEFAULT_NETWORK } from "../../constants";
import type {
  TransactionsArray,
  DecodedTransaction,
  DecodedSignedTransaction,
  Network,
} from "../../types";
import { ICON } from "./constants";
import type {
  WindowExtended,
  AlgoSignerTransaction,
  SupportedLedgers,
  AlgoSigner,
  AlgoSignerClientConstructor,
  InitParams,
} from "./types";

const getNetwork = (network: string): SupportedLedgers => {
  if (network === "betanet") {
    return "BetaNet";
  }

  if (network === "testnet") {
    return "TestNet";
  }

  if (network === "mainnet") {
    return "MainNet";
  }

  return network;
};

class AlgoSignerClient extends BaseWallet {
  #client: AlgoSigner;
  network: Network;

  constructor({
    client,
    algosdk,
    algodClient,
    network,
  }: AlgoSignerClientConstructor) {
    super(algosdk, algodClient);
    this.#client = client;
    this.network = network;
  }

  static metadata = {
    id: PROVIDER_ID.ALGOSIGNER,
    name: "AlgoSigner",
    icon: ICON,
    isWalletConnect: false,
  };

  static async init({
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK,
  }: InitParams) {
    try {
      if (
        typeof window == "undefined" ||
        (window as WindowExtended).AlgoSigner === undefined
      ) {
        throw new Error("AlgoSigner is not available.");
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk;
      const algodClient = await getAlgodClient(algosdk, algodOptions);
      const algosigner = (window as WindowExtended).AlgoSigner as AlgoSigner;

      return new AlgoSignerClient({
        id: PROVIDER_ID.ALGOSIGNER,
        client: algosigner,
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
    await this.#client.connect();

    const accounts = await this.#client.accounts({
      ledger: getNetwork(this.network),
    });

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${AlgoSignerClient.metadata.id}`);
    }

    const mappedAccounts = accounts.map(({ address }, index) => ({
      name: `AlgoSigner ${index + 1}`,
      address,
      providerId: AlgoSignerClient.metadata.id,
    }));

    return {
      ...AlgoSignerClient.metadata,
      accounts: mappedAccounts,
    };
  }

  async reconnect(onDisconnect: () => void) {
    if (
      window === undefined ||
      (window as WindowExtended).AlgoSigner === undefined
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
    transactions: Uint8Array[]
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn);
    }) as Array<DecodedTransaction | DecodedSignedTransaction>;

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<AlgoSignerTransaction[]>(
      (acc, txn, i) => {
        const txnObj: AlgoSignerTransaction = {
          txn: this.#client.encoding.msgpackToBase64(transactions[i]),
        };

        if (
          "txn" in txn ||
          !connectedAccounts.includes(this.algosdk.encodeAddress(txn["snd"]))
        ) {
          txnObj.txn = this.#client.encoding.msgpackToBase64(
            this.algosdk.decodeSignedTransaction(transactions[i]).txn.toByte()
          );
          txnObj.signers = [];
        }

        acc.push(txnObj);

        return acc;
      },
      []
    );

    // Sign them with the client.
    const result = await this.#client.signTxn(txnsToSign);

    // Join the newly signed transactions with the original group of transactions.
    const signedTxns = result.reduce<Uint8Array[]>((acc, txn, i) => {
      if (txn) {
        acc.push(new Uint8Array(Buffer.from(txn.blob, "base64")));
      } else {
        acc.push(transactions[i]);
      }

      return acc;
    }, []);

    return signedTxns;
  }

  /** @deprecated */
  formatTransactionsArray(
    transactions: TransactionsArray
  ): AlgoSignerTransaction[] {
    const formattedTransactions = transactions.map(([type, txn]) => {
      const formattedTxn: AlgoSignerTransaction = {
        txn: txn[1],
      };

      if (type === "s") {
        formattedTxn.signers = [];
        const decoded = this.algosdk.decodeSignedTransaction(
          new Uint8Array(Buffer.from(txn, "base64"))
        );
        formattedTxn.txn = this.#client.encoding.msgpackToBase64(
          decoded.txn.toByte()
        );
      } else {
        const decoded = this.algosdk.decodeUnsignedTransaction(
          Buffer.from(txn, "base64")
        );
        formattedTxn.txn = this.#client.encoding.msgpackToBase64(
          decoded.toByte()
        );
      }

      return formattedTxn;
    });

    return formattedTransactions;
  }

  /** @deprecated */
  async signEncodedTransactions(transactions: TransactionsArray) {
    const transactionsToSign = this.formatTransactionsArray(transactions);
    const result = await this.#client.signTxn(transactionsToSign);

    if (!result) {
      throw new Error("Signing failed.");
    }

    const signedRawTransactions = result.reduce(
      (signedTxns: Uint8Array[], txn, currentIndex) => {
        if (txn) {
          signedTxns.push(new Uint8Array(Buffer.from(txn.blob, "base64")));
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

export default AlgoSignerClient;
