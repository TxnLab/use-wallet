import Big from "big.js";
import { PROVIDER_ID, WalletClient } from "../types";
import { clients } from "../clients";

export const getWalletClient = async (
  id: PROVIDER_ID | undefined
): Promise<WalletClient> => {
  if (!id) {
    throw new Error("No wallet provider id provided");
  }

  const client = await clients[id].init().catch((e) => {
    if (typeof window !== "undefined") {
      console.error("error initializing WalletConnectClient", e);
      return;
    }
  });

  if (!client) {
    throw new Error(`No wallet client found for provider id: ${id}`);
  }

  return client;
};

export const getIsIOS = () => {
  if (typeof window !== "undefined") {
    return (
      /iPad|iPhone|iPod/.test(navigator?.userAgent) &&
      !(window as any)?.MSStream
    );
  } else {
    return false;
  }
};
