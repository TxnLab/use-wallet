import pera from "./pera";
import myAlgo from "./myalgo";
import defly from "./defly";
import exodus from "./exodus";
import algoSigner from "./algosigner";
import walletconnect from "./walletconnect";
import kmd from "./kmd";

export { pera, myAlgo, defly, exodus, algoSigner, walletconnect, kmd };

export default {
  [pera.metadata.id]: pera,
  [myAlgo.metadata.id]: myAlgo,
  [defly.metadata.id]: defly,
  [exodus.metadata.id]: exodus,
  [algoSigner.metadata.id]: algoSigner,
  [walletconnect.metadata.id]: walletconnect,
  [kmd.metadata.id]: kmd,
};
