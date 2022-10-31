import algosdk from "algosdk";
import { NODE_TOKEN, NODE_SERVER, NODE_PORT } from "../constants";

const algodClient = new algosdk.Algodv2(NODE_TOKEN, NODE_SERVER, NODE_PORT);

export { algosdk, algodClient };
