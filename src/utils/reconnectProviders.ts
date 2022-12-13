import { WalletClient } from "../types";
import { clearAccounts } from "./clearAccounts";

type SupportedProviders = { [x: string]: Promise<WalletClient | null> };

export const reconnectProviders = async (providers: SupportedProviders) => {
  try {
    const clients = Object.values(providers);

    for (const client of clients) {
      const c = await client;
      c?.reconnect(() => clearAccounts(c?.metadata.id));
    }
  } catch (e) {
    console.error(e);
  }
};
