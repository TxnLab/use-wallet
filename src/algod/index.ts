import type _algosdk from "algosdk";
import { NODE_TOKEN, NODE_SERVER, NODE_PORT } from "../constants";

export const getAlgosdk = async () => {
  return (await import("algosdk")).default;
};

export const getAlgodClient = async (algosdk: typeof _algosdk) => {
  return new algosdk.Algodv2(NODE_TOKEN, NODE_SERVER, NODE_PORT);
};

export default class Algod {
  algosdk: typeof _algosdk;
  algodClient: _algosdk.Algodv2;

  constructor(algosdk: typeof _algosdk, algodClient: _algosdk.Algodv2) {
    this.algosdk = algosdk;
    this.algodClient = algodClient;
  }

  static async init() {
    const algosdk = await getAlgosdk();
    const algodClient = await getAlgodClient(algosdk);

    return new Algod(algosdk, algodClient);
  }
}
