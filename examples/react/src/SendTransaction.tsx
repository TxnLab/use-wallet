import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { useState } from 'react'

type TxnStatus = 'idle' | 'signing' | 'confirming' | 'confirmed' | 'error'

// Post-quantum (Falcon) accounts pay more than the suggested fee, so simulate with empty
// signatures to find the fee the network requires
async function estimateFee(
  client: algosdk.Algodv2,
  txn: algosdk.Transaction,
  emptySigner: algosdk.TransactionSigner,
  minFee: bigint
) {
  const atc = new algosdk.AtomicTransactionComposer()
  atc.addTransaction({ txn, signer: emptySigner })
  const { simulateResponse } = await atc.simulate(
    client,
    new algosdk.modelsv2.SimulateRequest({
      txnGroups: [],
      allowEmptySignatures: true,
      fixSigners: true
    })
  )

  // groupUsage is in millionths of the min fee
  const { groupUsage } = simulateResponse.txnGroups[0]
  if (groupUsage === undefined) return txn.fee
  const fee = BigInt(Math.ceil((groupUsage * Number(minFee)) / 1_000_000))

  // Keep the suggested fee if higher. Its per-byte part (only under congestion) assumes an
  // ed25519 signature; a Falcon signature adds about 3 KB
  return fee > txn.fee ? fee : txn.fee
}

export function SendTransaction() {
  const { activeAddress, algodClient, transactionSigner, emptyTransactionSigner } = useWallet()
  const [status, setStatus] = useState<TxnStatus>('idle')
  const [txId, setTxId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!activeAddress) return

    try {
      setStatus('signing')
      setTxId(null)
      setError(null)

      const suggestedParams = await algodClient.getTransactionParams().do()

      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: activeAddress,
        amount: 0,
        suggestedParams
      })
      txn.fee = await estimateFee(algodClient, txn, emptyTransactionSigner, suggestedParams.minFee)

      const atc = new algosdk.AtomicTransactionComposer()
      atc.addTransaction({ txn, signer: transactionSigner })
      await atc.gatherSignatures()

      setStatus('confirming')
      const result = await atc.execute(algodClient, 4)

      setTxId(result.txIDs[0])
      setStatus('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Send Transaction</h3>
      <p className="text-sm text-gray-500 mb-4">
        Send a 0 ALGO payment to yourself as a test transaction.
      </p>

      <button
        onClick={handleSend}
        disabled={status === 'signing' || status === 'confirming'}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'signing'
          ? 'Signing...'
          : status === 'confirming'
            ? 'Confirming...'
            : 'Send 0 ALGO'}
      </button>

      {status === 'confirmed' && txId && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-sm font-medium text-green-800">Transaction confirmed</p>
          <p className="mt-1 text-xs text-green-600 font-mono break-all">{txId}</p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-800">Transaction failed</p>
          <p className="mt-1 text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
