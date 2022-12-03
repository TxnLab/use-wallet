import type _algosdk from "algosdk";
import { PROVIDER_ID } from "../../constants";
import type { AlgodClientOptions, Network } from "../../types";

export type WindowExtended = { AlgoSigner: AlgoSigner } & Window &
  typeof globalThis;

export type AlgoSignerTransaction = {
  txn: string;
  // array of addresses to sign with (defaults to the sender),
  // setting this to an empty array tells AlgoSigner
  // that this transaction is not meant to be signed
  signers?: [];
  multisig?: string; // address of a multisig wallet to sign with
};

export type SupportedLedgers = "MainNet" | "TestNet" | "BetaNet" | string;

export type AlgoSigner = {
  connect: () => Promise<Record<string, never>>;
  accounts: (ledger: {
    ledger: SupportedLedgers;
  }) => Promise<{ address: string }[]>;
  signTxn: (transactions: AlgoSignerTransaction[]) => Promise<
    {
      txID: string;
      blob: string;
    }[]
  >;
  encoding: {
    msgpackToBase64(transaction: Uint8Array): string;
    byteArrayToString(transaction: Uint8Array): string;
  };
};

export type AlgoSignerClientConstructor = {
  client: AlgoSigner;
  id: PROVIDER_ID;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
  network: SupportedLedgers;
};

export type InitParams = {
  algodOptions?: AlgodClientOptions;
  algosdkStatic?: typeof _algosdk;
  network?: Network;
};
