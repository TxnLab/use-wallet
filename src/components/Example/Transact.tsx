import React from 'react'
import { useWallet } from '../../index'
import algosdk from 'algosdk'
const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud/', '443')

export default function Transact() {
  const { activeAccount, signTransactions, sendTransactions } = useWallet()

  const sendTransaction = async (from?: string, to?: string, amount?: number) => {
    if (!from || !to || !amount) {
      throw new Error('Missing transaction params.')
    }
    const params = await algodClient.getTransactionParams().do()
    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from,
      to,
      amount,
      suggestedParams: params
    })
    const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction)
    const signedTransactions = await signTransactions([encodedTransaction])
    const waitRoundsToConfirm = 4
    const { id } = await sendTransactions(signedTransactions, waitRoundsToConfirm)
    console.log('Successfully sent transaction. Transaction ID: ', id)
  }
  if (!activeAccount) {
    return <p>Connect an account first.</p>
  }
  return (
    <div>
      <button
        onClick={() => sendTransaction(activeAccount?.address, activeAccount?.address, 1000)}
        className="button"
      >
        Sign and send transactions
      </button>
    </div>
  )
}
