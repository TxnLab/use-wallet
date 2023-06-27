import pera from './pera'
import daffi from './daffi'
import myalgo from './myalgo'
import defly from './defly'
import exodus from './exodus'
import algosigner from './algosigner'
import walletconnect from './walletconnect2'
import kmd from './kmd'
import mnemonic from './mnemonic'

export { pera, myalgo, defly, exodus, algosigner, walletconnect, kmd, mnemonic }

export default {
  [pera.metadata.id]: pera,
  [daffi.metadata.id]: daffi,
  [myalgo.metadata.id]: myalgo,
  [defly.metadata.id]: defly,
  [exodus.metadata.id]: exodus,
  [algosigner.metadata.id]: algosigner,
  [walletconnect.metadata.id]: walletconnect,
  [kmd.metadata.id]: kmd,
  [mnemonic.metadata.id]: mnemonic
}
