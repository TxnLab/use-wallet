import type { Transaction } from "algosdk";
import type { AlgodClientOptions, Network } from "../../types";
import type { DeflyWalletConnect } from "@blockshake/defly-connect";
import type _algosdk from "algosdk";

export type ClientOptions = {
  bridge?: string;
  deep_link?: string;
  app_meta?: {
    logo: string;
    name: string;
    main_color: string;
  };
  shouldShowSignTxnToast?: boolean;
};

export type DeflyTransaction = {
  txn: Transaction;
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[];
};

export type DeflyWalletClientConstructor = {
  client: DeflyWalletConnect;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
  network: Network;
};

export type InitParams = {
  clientOptions?: ClientOptions;
  algodOptions?: AlgodClientOptions;
  clientStatic?: typeof DeflyWalletConnect;
  algosdkStatic?: typeof _algosdk;
  network?: Network;
};
