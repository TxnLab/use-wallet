import { PROVIDER_ID } from "../../constants";
import type _algosdk from "algosdk";
import type { AlgodClientOptions, Network } from "../../types";

export type ClientOptions = {
  onlyIfTrusted: boolean;
};

export type WindowExtended = { exodus: { algorand: Exodus } } & Window &
  typeof globalThis;

export type Bytes = Readonly<Uint8Array>;

export type Exodus = {
  isConnected: boolean;
  address: string | null;
  connect: ({ onlyIfTrusted }: { onlyIfTrusted: boolean }) => Promise<{
    address: string;
  }>;
  disconnect: () => void;
  signAndSendTransaction(transactions: Bytes[]): Promise<{
    txId: string;
  }>;
  signTransaction(transactions: Bytes[]): Promise<Bytes[]>;
};

export type ExodusClientConstructor = {
  client: Exodus;
  id: PROVIDER_ID;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
  onlyIfTrusted: boolean;
  network: Network;
};

export type InitParams = {
  clientOptions?: ClientOptions;
  algodOptions?: AlgodClientOptions;
  algosdkStatic?: typeof _algosdk;
  network?: Network;
};
