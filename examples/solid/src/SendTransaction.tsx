import { useWallet } from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'
import { createSignal, Show } from 'solid-js'

type TxnStatus = 'idle' | 'signing' | 'confirming' | 'confirmed' | 'error'

export function SendTransaction() {
  const { activeAddress, algodClient, transactionSigner } = useWallet()
  const [status, setStatus] = createSignal<TxnStatus>('idle')
  const [txId, setTxId] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const handleSend = async () => {
    const address = activeAddress()
    if (!address) return

    try {
      setStatus('signing')
      setTxId(null)
      setError(null)

      const suggestedParams = await algodClient().getTransactionParams().do()

      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address,
        receiver: address,
        amount: 0,
        suggestedParams
      })

      const atc = new algosdk.AtomicTransactionComposer()
      atc.addTransaction({ txn, signer: transactionSigner })
      await atc.gatherSignatures()

      setStatus('confirming')
      const result = await atc.execute(algodClient(), 4)

      setTxId(result.txIDs[0] ?? null)
      setStatus('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
      setStatus('error')
    }
  }

  return (
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 class="text-sm font-semibold text-gray-900 mb-4">Send Transaction</h3>
      <p class="text-sm text-gray-500 mb-4">
        Send a 0 ALGO payment to yourself as a test transaction.
      </p>

      <button
        onClick={handleSend}
        disabled={status() === 'signing' || status() === 'confirming'}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status() === 'signing'
          ? 'Signing...'
          : status() === 'confirming'
            ? 'Confirming...'
            : 'Send 0 ALGO'}
      </button>

      <Show when={status() === 'confirmed' && txId()}>
        <div class="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
          <p class="text-sm font-medium text-green-800">Transaction confirmed</p>
          <p class="mt-1 text-xs text-green-600 font-mono break-all">{txId()}</p>
        </div>
      </Show>

      <Show when={status() === 'error' && error()}>
        <div class="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p class="text-sm font-medium text-red-800">Transaction failed</p>
          <p class="mt-1 text-xs text-red-600">{error()}</p>
        </div>
      </Show>
    </div>
  )
}
