import type { TransactionType } from "algosdk";

export type Txn = {
  apaa: Uint8Array;
  apas: number[];
  apid: number;
  fee: number;
  fv: number;
  gen: string;
  gh: Uint8Array;
  grp: Uint8Array;
  lv: number;
  snd: Uint8Array;
  type: string;
};

export type ConfirmedTxn = {
  "confirmed-round": number;
  "global-state-delta": Record<string, unknown>[];
  "pool-error": string;
  txn: {
    sig: Uint8Array;
    txn: Txn;
  };
};

export type DecodedTransaction = {
  amt: number;
  fee: number;
  fv: number;
  gen: string;
  gh: Uint8Array;
  grp: Uint8Array;
  lv: 24909934;
  note: Uint8Array;
  rcv: Uint8Array;
  snd: Uint8Array;
  type: TransactionType;
};

export type DecodedSignedTransaction = {
  sig: Uint8Array;
  txn: DecodedTransaction;
};

export type TxnType = TransactionType;
