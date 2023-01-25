export type NFDTransactionsArray = ["u" | "s", string][];

export function encodeNFDTransactionsArray(
  transactionsArray: NFDTransactionsArray
) {
  return transactionsArray.map(([type, txn]) => {
    return new Uint8Array(Buffer.from(txn, "base64"));
  });
}
