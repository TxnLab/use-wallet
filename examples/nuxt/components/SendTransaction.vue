<script setup lang="ts">
import { ref } from 'vue'
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'

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

const { activeAddress, algodClient, transactionSigner, emptyTransactionSigner } = useWallet()
const status = ref<TxnStatus>('idle')
const txId = ref<string | null>(null)
const error = ref<string | null>(null)

const handleSend = async () => {
  if (!activeAddress.value) return

  try {
    status.value = 'signing'
    txId.value = null
    error.value = null

    const suggestedParams = await algodClient.value.getTransactionParams().do()

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAddress.value,
      receiver: activeAddress.value,
      amount: 0,
      suggestedParams
    })
    txn.fee = await estimateFee(
      algodClient.value,
      txn,
      emptyTransactionSigner,
      suggestedParams.minFee
    )

    const atc = new algosdk.AtomicTransactionComposer()
    atc.addTransaction({ txn, signer: transactionSigner })
    await atc.gatherSignatures()

    status.value = 'confirming'
    const result = await atc.execute(algodClient.value, 4)

    txId.value = result.txIDs[0] ?? null
    status.value = 'confirmed'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Transaction failed'
    status.value = 'error'
  }
}
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white p-6">
    <h3 class="text-sm font-semibold text-gray-900 mb-4">Send Transaction</h3>
    <p class="text-sm text-gray-500 mb-4">
      Send a 0 ALGO payment to yourself as a test transaction.
    </p>

    <button
      @click="handleSend"
      :disabled="status === 'signing' || status === 'confirming'"
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {{
        status === 'signing'
          ? 'Signing...'
          : status === 'confirming'
            ? 'Confirming...'
            : 'Send 0 ALGO'
      }}
    </button>

    <div
      v-if="status === 'confirmed' && txId"
      class="mt-4 rounded-lg bg-green-50 border border-green-200 p-3"
    >
      <p class="text-sm font-medium text-green-800">Transaction confirmed</p>
      <p class="mt-1 text-xs text-green-600 font-mono break-all">{{ txId }}</p>
    </div>

    <div
      v-if="status === 'error' && error"
      class="mt-4 rounded-lg bg-red-50 border border-red-200 p-3"
    >
      <p class="text-sm font-medium text-red-800">Transaction failed</p>
      <p class="mt-1 text-xs text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
