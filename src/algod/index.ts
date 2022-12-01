import type _algosdk from "algosdk";
import type { AlgodClientOptions } from "../types";

export const getAlgosdk = async () => {
  return (await import("algosdk")).default;
};

export const getAlgodClient = async (
  algosdk: typeof _algosdk,
  algodClientOptions?: AlgodClientOptions
) => {
  const [
    tokenOrBaseClient = "",
    baseServer = "https://mainnet-api.algonode.cloud",
    port = "",
    headers,
  ] = algodClientOptions || [];

  return new algosdk.Algodv2(tokenOrBaseClient, baseServer, port, headers);
};

export default class Algod {
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;

  constructor(algosdk: typeof _algosdk, algodClient: _algosdk.Algodv2) {
    this.algosdk = algosdk;
    this.algodClient = algodClient;
  }

  static async init(algodOptions?: AlgodClientOptions) {
    const algosdk = await getAlgosdk();
    const algodClient = await getAlgodClient(algosdk, algodOptions);

    return new Algod(algosdk, algodClient);
  }
}
