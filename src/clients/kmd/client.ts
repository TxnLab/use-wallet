import type _algosdk from "algosdk";
import Algod, { getAlgodClient } from "../../algod";
import BaseWallet from "../base";
import { DEFAULT_NETWORK, PROVIDER_ID } from "../../constants";
import type { Account, Wallet, TransactionsArray, Network } from "../../types";
import { ICON } from "./constants";
import {
  InitParams,
  ListWalletResponse,
  InitWalletHandle,
  KMDWalletClientConstructor,
} from "./types";

class KMDWalletClient extends BaseWallet {
  #client: _algosdk.Kmd;
  #wallet: string;
  #password: string;
  walletId: string;
  id: PROVIDER_ID;
  network: Network;

  constructor({
    metadata,
    client,
    id,
    wallet,
    password,
    algosdk,
    algodClient,
    network,
  }: KMDWalletClientConstructor) {
    super(metadata, algosdk, algodClient);

    this.#client = client;
    this.#wallet = wallet;
    this.#password = password;
    this.id = id;
    this.walletId = "";
    this.network = network;
    this.metadata = KMDWalletClient.metadata;
  }

  static metadata = {
    id: PROVIDER_ID.KMD,
    name: "KMD",
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
      const {
        token = "a".repeat(64),
        host = "http://localhost",
        port = "4002",
        wallet = "unencrypted-default-wallet",
        password = "",
      } = clientOptions || {};

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk;
      const algodClient = await getAlgodClient(algosdk, algodOptions);
      const kmdClient = new algosdk.Kmd(token, host, port);

      return new KMDWalletClient({
        metadata: KMDWalletClient.metadata,
        id: PROVIDER_ID.KMD,
        password,
        wallet,
        client: kmdClient,
        algosdk: algosdk,
        algodClient: algodClient,
        network,
      });
    } catch (e) {
      console.error("Error initializing...", e);
      return null;
    }
  }

  async connect(): Promise<Wallet> {
    // TODO: prompt for wallet and password?
    return {
      ...KMDWalletClient.metadata,
      accounts: await this.listAccounts(
        this.#wallet,
        await this.requestPassword()
      ),
    };
  }

  async disconnect() {
    return;
  }

  async reconnect(): Promise<Wallet | null> {
    return null;
  }

  async requestPassword(): Promise<string> {
    // TODO: store it locally?
    const pw = prompt("gib password");
    return pw ? pw : "";
  }

  async getWalletToken(walletId: string, password: string): Promise<string> {
    const handleResp: InitWalletHandle = await this.#client.initWalletHandle(
      walletId,
      password
    );
    return handleResp.wallet_handle_token;
  }

  async releaseToken(token: string): Promise<void> {
    await this.#client.releaseWalletHandle(token);
  }

  async listWallets(): Promise<Record<string, string>> {
    const walletResponse = await this.#client.listWallets();
    const walletList: Array<ListWalletResponse> = walletResponse["wallets"];
    const walletMap: Record<string, string> = {};
    for (const w of walletList) {
      walletMap[w.name] = w.id;
    }
    return walletMap;
  }

  async listAccounts(
    wallet: string,
    password: string
  ): Promise<Array<Account>> {
    const walletMap = await this.listWallets();

    if (!(wallet in walletMap)) throw Error("No wallet named: " + wallet);

    this.walletId = walletMap[wallet];

    // Get a handle token
    const token = await this.getWalletToken(this.walletId, password);

    // Fetch accounts and format them as lib expects
    const listResponse = await this.#client.listKeys(token);
    const addresses: Array<string> = listResponse["addresses"];
    const mappedAccounts = addresses.map((address: string, index: number) => {
      return {
        name: `KMDWallet ${index + 1}`,
        address,
        providerId: KMDWalletClient.metadata.id,
      };
    });

    // Release handle token
    this.releaseToken(token);

    return mappedAccounts;
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
    }) as Array<
      _algosdk.EncodedTransaction | _algosdk.EncodedSignedTransaction
    >;

    // Get a handle token
    const pw = await this.requestPassword();
    const token = await this.getWalletToken(this.walletId, pw);

    const signedTxns: Array<Uint8Array> = [];
    // Sign them with the client.
    const signingPromises: Promise<Uint8Array>[] = [];

    for (const idx in decodedTxns) {
      const dtxn = decodedTxns[idx];
      const isSigned = "txn" in dtxn;

      // push the incoming txn into signed, we'll overwrite it later
      signedTxns.push(transactions[idx]);

      // Its already signed, skip it
      if (isSigned) {
        continue;
        // Not specified in indexes to sign, skip it
      } else if (
        indexesToSign &&
        indexesToSign.length &&
        !indexesToSign.includes(Number(idx))
      ) {
        continue;
      }
      // Not to be signed by our signer, skip it
      else if (
        !connectedAccounts.includes(this.algosdk.encodeAddress(dtxn.snd))
      ) {
        continue;
      }

      // overwrite with an empty blob
      signedTxns[idx] = new Uint8Array();

      const txn = this.algosdk.Transaction.from_obj_for_encoding(dtxn);
      signingPromises.push(this.#client.signTransaction(token, pw, txn));
    }

    const signingResults = await Promise.all(signingPromises);

    // Restore the newly signed txns in the correct order
    let signedIdx = 0;

    const formattedTxns = signedTxns.reduce<Uint8Array[]>((acc, txn, i) => {
      // If its an empty array, infer that it is one of the
      // ones we wanted to have signed and overwrite the empty buff
      if (txn.length === 0) {
        acc.push(signingResults[signedIdx]);

        signedIdx += 1;
      } else if (returnGroup) {
        acc.push(txn);
      }

      return acc;
    }, []);

    return formattedTxns;
  }

  signEncodedTransactions(
    transactions: TransactionsArray
  ): Promise<Uint8Array[]> {
    throw new Error("Method not implemented.");
  }
}

export default KMDWalletClient;
