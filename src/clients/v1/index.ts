import { PROVIDER_ID } from "../../constants";
import defly from "./defly";
import myAlgo from "./myalgo";
import algoSigner from "./algosigner";
import exodus from "./exodus";
import pera from "./pera";

export { defly, myAlgo, algoSigner, exodus, pera };

export default {
  [defly.metadata.id]: defly,
  [myAlgo.metadata.id]: myAlgo,
  [algoSigner.metadata.id]: algoSigner,
  [exodus.metadata.id]: exodus,
  [pera.metadata.id]: pera,
};
