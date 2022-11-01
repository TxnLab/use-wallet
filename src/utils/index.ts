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
