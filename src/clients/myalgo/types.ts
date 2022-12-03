/**
 * Helpful resources:
 * https://github.com/randlabs/myalgo-connect
 */
import type _MyAlgoConnect from "@randlabs/myalgo-connect";
import type _algosdk from "algosdk";
import { AlgodClientOptions, Network } from "../../types";

export type MyAlgoWalletClientConstructor = {
  client: _MyAlgoConnect;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
  network: Network;
};

export type ClientOptions = {
  disableLedgerNano: boolean;
};

export type InitParams = {
  clientOptions?: ClientOptions;
  algodOptions?: AlgodClientOptions;
  clientStatic?: typeof _MyAlgoConnect;
  algosdkStatic?: typeof _algosdk;
  network?: Network;
};
