import { PROVIDER_ID } from "../constants";
import type BaseWallet from "../clients/base";

export interface Account {
  providerId: PROVIDER_ID;
  name: string;
  address: string;
}

export type Provider = {
  id: PROVIDER_ID;
  name: string;
  icon: string;
  isActive: boolean;
  isConnected: boolean;
  isWalletConnect: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  setActive: () => Promise<void>;
};

export type Asset = {
  amount: number;
  "asset-id": number;
  creator: string;
  "is-frozen": boolean;
  "unit-name": string;
  name: string;
};

// We can add more properties as needed...
// See https://algorand.github.io/js-algorand-sdk/classes/modelsv2.Account.html
// but keep in mind the actual properties are kebab case not camel case
export type AccountInfo = {
  address: string;
  amount: number;
  assets: Asset[];
  "min-balance": number;
};

export type WalletProvider = {
  id: PROVIDER_ID;
  name: string;
  icon: string;
  isWalletConnect: boolean;
};

type ExtendValues<Type> = {
  [Property in keyof Type]: Type[Property] | null;
};

// This type extends the values of `WalletProvider` with `null` values
// and adds the `accounts` property.
export type Wallet = ExtendValues<WalletProvider> & {
  accounts: Account[];
};

export type WalletClient = BaseWallet;

export { PROVIDER_ID };
