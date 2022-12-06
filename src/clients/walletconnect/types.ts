import type _algosdk from "algosdk";
import type WalletConnect from "@walletconnect/client";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import type { AlgodClientOptions, Network } from "../../types";

export interface IClientMeta {
  description: string;
  url: string;
  icons: string[];
  name: string;
}

export interface IWalletConnectSession {
  connected: boolean;
  accounts: string[];
  chainId: number;
  bridge: string;
  key: string;
  clientId: string;
  clientMeta: IClientMeta | null;
  peerId: string;
  peerMeta: IClientMeta | null;
  handshakeId: number;
  handshakeTopic: string;
  qrcodeModal: {
    open: (uri: string, cb: any, qrcodeModalOptions?: any) => void;
    close: () => void;
  };
}

export type ClientOptions = {
  bridge?: string;
  uri?: string;
  storageId?: string;
  signingMethods?: string[];
  session?: IWalletConnectSession;
  clientMeta?: IClientMeta;
};

export type WalletConnectTransaction = {
  txn: string;
  message?: string;
  // if the transaction does not need to be signed,
  // because it is part of an atomic group that will be signed by another party,
  // specify an empty signers array
  signers?: string[] | [];
};

export type InitParams = {
  clientOptions?: ClientOptions;
  algodOptions?: AlgodClientOptions;
  clientStatic?: typeof WalletConnect;
  modalStatic?: typeof QRCodeModal;
  algosdkStatic?: typeof _algosdk;
  network?: Network;
};

export type WalletConnectClientConstructor = {
  client: WalletConnect;
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;
  network: Network;
};
