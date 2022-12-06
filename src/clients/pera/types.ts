import type _algosdk from "algosdk";
import type { PeraWalletConnect } from "@perawallet/connect";
import type { Transaction } from "algosdk";
import type { AlgodClientOptions, Network } from "../../types";

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

export interface PeraTransaction {
  txn: Transaction;
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[];
}

export type PeraWalletClientConstructor = {
  client: PeraWalletConnect;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
  network: Network;
};

export type InitParams = {
  clientOptions?: ClientOptions;
  algodOptions?: AlgodClientOptions;
  clientStatic?: typeof PeraWalletConnect;
  algosdkStatic?: typeof _algosdk;
  network?: Network;
};
