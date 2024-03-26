<script setup lang="ts">
import { useWallet, type Wallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'
import { ref } from 'vue'

const { algodClient, transactionSigner, wallets } = useWallet()
const isSending = ref(false)

const setActiveAccount = (event: Event, wallet: Wallet) => {
  const target = event.target as HTMLSelectElement
  wallet.setActiveAccount(target.value)
}

const sendTransaction = async (wallet: Wallet) => {
  if (!wallet.activeAccount?.address) {
    alert('No active account')
    return
  }

  isSending.value = true

  try {
    const atc = new algosdk.AtomicTransactionComposer()
    const suggestedParams = await algodClient.getTransactionParams().do()

    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: wallet.activeAccount.address,
      to: wallet.activeAccount.address,
      amount: 0,
      suggestedParams
    })

    atc.addTransaction({ txn: transaction, signer: transactionSigner })

    console.info(`[App] Sending transaction...`, transaction)

    const result = await atc.execute(algodClient, 4)

    console.info(`[App] ✅ Successfully sent transaction!`, {
      confirmedRound: result.confirmedRound,
      txIDs: result.txIDs
    })
  } catch (error) {
    console.error('[App] Error signing transaction:', error)
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <div>
    <div v-for="wallet in wallets" :key="wallet.id">
      <h4>{{ wallet.metadata.name }} <span v-if="wallet.isActive">[active]</span></h4>
      <div class="wallet-buttons">
        <button @click="wallet.connect()" :disabled="wallet.isConnected">Connect</button>
        <button @click="wallet.disconnect()" :disabled="!wallet.isConnected">Disconnect</button>
        <button
          v-if="!wallet.isActive"
          @click="wallet.setActive()"
          :disabled="!wallet.isConnected || wallet.isActive"
        >
          Set Active
        </button>
        <button v-else @click="sendTransaction(wallet)" :disabled="isSending">
          {{ isSending ? 'Sending Transaction...' : 'Send Transaction' }}
        </button>
      </div>
      <div v-if="wallet.isActive && wallet.accounts.length > 0">
        <select @change="(event) => setActiveAccount(event, wallet)">
          <option
            v-for="account in wallet.accounts"
            :key="account.address"
            :value="account.address"
          >
            {{ account.address }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-bottom: 2em;
}
</style>
