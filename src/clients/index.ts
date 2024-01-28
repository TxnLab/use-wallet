import pera from './pera'
import daffi from './daffi'
import myalgo from './myalgo'
import defly from './defly'
import exodus from './exodus'
import algosigner from './algosigner'
import lute from './lute'
import walletconnect from './walletconnect2'
import magic from './magic'
import kmd from './kmd'
import mnemonic from './mnemonic'
import { CustomProvider } from './custom/types'
import custom from './custom'
import kibisis from './kibisis'

export {
  pera,
  myalgo,
  defly,
  exodus,
  algosigner,
  lute,
  walletconnect,
  kmd,
  mnemonic,
  custom,
  CustomProvider,
  kibisis,
  magic
}

export default {
  [pera.metadata.id]: pera,
  [daffi.metadata.id]: daffi,
  [myalgo.metadata.id]: myalgo,
  [defly.metadata.id]: defly,
  [exodus.metadata.id]: exodus,
  [algosigner.metadata.id]: algosigner,
  [lute.metadata.id]: lute,
  [walletconnect.metadata.id]: walletconnect,
  [kmd.metadata.id]: kmd,
  [mnemonic.metadata.id]: mnemonic,
  [custom.metadata.id]: custom,
  [kibisis.metadata.id]: kibisis,
  [magic.metadata.id]: magic
}
