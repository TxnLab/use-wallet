import React from "react";
import "./Wallet.scss";
import { useWallet, useConnectWallet } from "../../index";
import algosdk from "algosdk";
import { NODE_TOKEN, NODE_SERVER, NODE_PORT } from "../../constants";

const algodClient = new algosdk.Algodv2(NODE_TOKEN, NODE_SERVER, NODE_PORT);

export type WalletProps = {
  foo?: string;
};

export default function Wallet(props: WalletProps) {
  const { reconnectProviders } = useConnectWallet();
  const { activeAccount, signTransactions, sendTransactions } = useWallet();

  // Reconnect the session when the user returns to the dApp
  React.useEffect(() => {
    reconnectProviders();
  }, []);

  const sendTransaction = async (
    from?: string,
    to?: string,
    amount?: number
  ) => {
    if (!from || !to || !amount) {
      throw new Error("Missing transaction params.");
    }

    const params = await algodClient.getTransactionParams().do();

    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from,
      to,
      amount,
      suggestedParams: params,
    });

    const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction);
    const signedTransactions = await signTransactions([encodedTransaction]);

    const { id } = await sendTransactions(signedTransactions, 4);

    console.log("Successfully sent transaction. Transaction ID: ", id);
  };

  if (!activeAccount) {
    return <p>Connect an account first.</p>;
  }

  return (
    <div>
      <button
        onClick={() =>
          sendTransaction(activeAccount?.address, activeAccount?.address, 1000)
        }
        className="button"
      >
        Sign and send transactions
      </button>
    </div>
  );
}
