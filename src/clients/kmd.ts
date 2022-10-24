import algosdk, { decodeSignedTransaction, EncodedSignedTransaction, EncodedTransaction, SignedTransaction } from "algosdk";
import BaseWallet from "./base";
import type { InitAlgodClient } from "./base";
import { PROVIDER_ID, NODE_TOKEN, NODE_SERVER, NODE_PORT } from "../constants";
import { providers } from "../providers";
import type { Account, Wallet, WalletProvider } from "../types";
import { TransactionsArray } from "../types";
import type { DecodedTransaction, DecodedSignedTransaction } from "../types";

// Default config settings for dev sandbox kmd
const DEFAULT_KMD_TOKEN = "a".repeat(64);
const DEFAULT_KMD_HOST = "http://localhost";
const DEFAULT_KMD_PORT = "4002";
const DEFAULT_KMD_WALLET = "unencrypted-default-wallet";
const DEFAULT_KMD_PASSWORD = "";

type KMDConfig = {
  host: string;
  port: string;
  token: string;
};

const DefaultKMDConfig = {
  host: DEFAULT_KMD_HOST,
  token: DEFAULT_KMD_TOKEN,
  port: DEFAULT_KMD_PORT,
} as KMDConfig;

interface ListWalletResponse {
    id: string,
    name:	string,
    driver_name?: 	string,
    driver_version?: number,
    mnemonic_ux?:	boolean,
    supported_txs?: Array<any>,
}
interface SignTransactionResponse {
  signed_transaction: Uint8Array 
  error?:		boolean,
  message?: 		string,
}

interface InitWalletHandle {
  wallet_handle_token: string,
  message?: 	string,
  error?:boolean,
}


type InitWallet = {
  client: algosdk.Kmd;
  id: PROVIDER_ID;
  providers: typeof providers;
};

class KMDWallet extends BaseWallet {
  #client: algosdk.Kmd;
  walletId: string;
  id: PROVIDER_ID;
  provider: WalletProvider;

  constructor(initAlgodClient: InitAlgodClient, initWallet: InitWallet) {
    super(initAlgodClient);

    this.#client = initWallet.client;
    this.id = initWallet.id;
    this.provider = initWallet.providers[this.id];
    this.walletId = "";
  }

  static async init() {
    const initAlgodClient: InitAlgodClient = {
      algosdk,
      token: NODE_TOKEN,
      server: NODE_SERVER,
      port: NODE_PORT,
    };

    // TODO: allow diff config options?
    const kmdConfig: KMDConfig = DefaultKMDConfig;

    const kmdClient = new algosdk.Kmd(
      kmdConfig.token,
      kmdConfig.host,
      kmdConfig.port
    );

    const initWallet: InitWallet = {
      id: PROVIDER_ID.KMD_WALLET,
      client: kmdClient,
      providers: providers,
    };

    return new KMDWallet(initAlgodClient, initWallet);
  }

  async connect(): Promise<Wallet> {
    // TODO: prompt for wallet and password?
    return {
      ...this.provider,
      accounts: await this.listAccounts(DEFAULT_KMD_WALLET, await this.requestPassword()),
    }
  }

  async disconnect() {
    return;
  }

  async reconnect(): Promise<Wallet | null> {
    return {
      ...this.provider,
      accounts: await this.listAccounts(DEFAULT_KMD_WALLET, await this.requestPassword()),
    }
  }

  async requestPassword(): Promise<string> {
    const pw = prompt("gib password")
    return pw?pw:""
  }

  async getWalletToken(walletId: string, password: string): Promise<string> {
    const handleResp: InitWalletHandle = await this.#client.initWalletHandle(
      walletId, password
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
    for(const w of walletList){
      walletMap[w.name] = w.id
    }
    return walletMap;
  }

  async listAccounts(wallet: string, password: string): Promise<Array<Account>> {
    const walletMap = await this.listWallets();

    if(!(wallet in walletMap)) throw Error("No wallet named: " + wallet);

    this.walletId = walletMap[wallet];

    // Get a handle token
    const token = await this.getWalletToken(this.walletId, password) ;

    // Fetch accounts and format them as lib expects
    const listResponse = await this.#client.listKeys(token);
    const addresses: Array<string> = listResponse["addresses"];
    const mappedAccounts = addresses.map((address: string, index: number)=>{
      return {
        name:`KMDWallet ${index + 1}`,
        address,
        providerId: this.provider.id,
      }
    })

    // Release handle token
    this.releaseToken(token)

    return mappedAccounts;
  }


  async signTransactions(activeAddress: string, transactions: Uint8Array[]) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return algosdk.decodeObj(txn);
    }) as Array<EncodedTransaction | EncodedSignedTransaction>;

    // Get a handle token
    const pw = await this.requestPassword()
    const token = await this.getWalletToken(this.walletId, pw);

    const signedTxns: Uint8Array[] = [];
    // Sign them with the client.
    const signingPromises: Promise<Uint8Array>[] = [];
    for(const idx in decodedTxns){
      const dtxn = decodedTxns[idx];

      // push the incoming txn into signed, we'll overwrite it later
      signedTxns.push(transactions[idx])

      // Its already signed, skip it
      if(!('snd' in dtxn)) continue;
      // Not to be signed by our signer, skip it
      if(!(algosdk.encodeAddress(dtxn.snd) === activeAddress)) continue;

      // overwrite with an empty blob
      signedTxns[idx] = new Uint8Array();

      const txn = algosdk.Transaction.from_obj_for_encoding(dtxn);
      signingPromises.push(this.#client.signTransaction(token, pw, txn));
    }

    const signingResults = await Promise.all(signingPromises);
    console.log("Signing results: s")
    console.log(signingResults.map((b)=>{return algosdk.decodeSignedTransaction(b)}))

    // Restore the newly signed txns in the correct order
    let signedIdx = 0;
    for(const idx in signedTxns){
      // Empty array, its one of the ones we wanted to have signed
      if (signedTxns[idx].length === 0){
        signedTxns[idx] = signingResults[signedIdx];
        signedIdx += 1
      }
    }
    console.log(signedTxns.map((b)=>{return algosdk.decodeSignedTransaction(b)}))

    return signedTxns
  }

  signEncodedTransactions(transactions: TransactionsArray): Promise<Uint8Array[]> {
    throw new Error("Method not implemented.");
  }

}


export default KMDWallet.init().catch((e) => {
  if (typeof window !== "undefined") {
    console.info("error initializing kmd client", e);
    return;
  }
});