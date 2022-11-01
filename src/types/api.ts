import { TxnType } from "./node";

export type TransactionsArray = ["u" | "s", string][];

export type TxnInfo = {
  groupIndex: number;
  amount: number;
  from: string;
  to: string;
  type: TxnType;
  txn: string;
  signedTxn?: Uint8Array;
};
