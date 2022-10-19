import Big from "big.js";
import { PROVIDER_ID, WalletClient } from "../types";
import { clients } from "../clients";

export const getWalletClient = async (
  id: PROVIDER_ID | undefined
): Promise<WalletClient> => {
  if (!id) {
    throw new Error("No wallet provider id provided");
  }

  const client = await clients[id];

  if (!client) {
    throw new Error(`No wallet client found for provider id: ${id}`);
  }

  return client;
};

export const formatPrice = (
  price: number,
  isAlgos?: boolean,
  options?: Intl.NumberFormatOptions | undefined
) => {
  const algos = isAlgos ? price : convertMicroalgosToAlgos(price);
  return new Intl.NumberFormat(undefined, options).format(algos);
};

// Formula: amount / (10 ^ decimals)
export const convertMicroalgosToAlgos = (amount: number) => {
  const divisor = new Big(10).pow(6);
  return new Big(amount).div(divisor).round(6).toNumber();
};
