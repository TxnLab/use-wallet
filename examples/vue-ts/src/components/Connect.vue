<script setup lang="ts">
import { NetworkId, WalletId, useWallet, type Wallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'
import { ref } from 'vue'

const { algodClient, activeNetwork, setActiveNetwork, transactionSigner, wallets } = useWallet()
const isSending = ref(false)
const magicEmail = ref('')

const isMagicLink = (wallet: Wallet) => wallet.id === WalletId.MAGIC
const isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail.value)
const isConnectDisabled = (wallet: Wallet) =>
  wallet.isConnected || (isMagicLink(wallet) && !isEmailValid())

const getConnectArgs = (wallet: Wallet) => {
  if (isMagicLink(wallet)) {
    return { email: magicEmail.value }
  }
  return undefined
}

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
    const suggestedParams = await algodClient.value.getTransactionParams().do()

    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: wallet.activeAccount.address,
      to: wallet.activeAccount.address,
      amount: 0,
      suggestedParams
    })

    atc.addTransaction({ txn: transaction, signer: transactionSigner })

    console.info(`[App] Sending transaction...`, transaction)

    const result = await atc.execute(algodClient.value, 4)

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
    <div className="network-group">
      <h4>
        Current Network: <span className="active-network">{{ activeNetwork }}</span>
      </h4>
      <div className="network-buttons">
        <button
          type="button"
          @click="() => setActiveNetwork(NetworkId.BETANET)"
          :disabled="activeNetwork === NetworkId.BETANET"
        >
          Set to Betanet
        </button>
        <button
          type="button"
          @click="() => setActiveNetwork(NetworkId.TESTNET)"
          :disabled="activeNetwork === NetworkId.TESTNET"
        >
          Set to Testnet
        </button>
        <button
          type="button"
          @click="() => setActiveNetwork(NetworkId.MAINNET)"
          :disabled="activeNetwork === NetworkId.MAINNET"
        >
          Set to Mainnet
        </button>
      </div>
    </div>

    <div v-for="wallet in wallets" :key="wallet.id" class="wallet-group">
      <h4>{{ wallet.metadata.name }} <span v-if="wallet.isActive">[active]</span></h4>
      <div class="wallet-buttons">
        <button
          @click="wallet.connect(getConnectArgs(wallet))"
          :disabled="isConnectDisabled(wallet)"
        >
          Connect
        </button>
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

      <div v-if="isMagicLink(wallet)" class="input-group">
        <label for="magic-email">Email:</label>
        <input
          id="magic-email"
          type="email"
          v-model="magicEmail"
          placeholder="Enter email to connect..."
          :disabled="wallet.isConnected"
        />
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
.network-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  margin: 2em;
  padding: 2em;
  background-color: light-dark(rgba(0, 0, 0, 0.025), rgba(255, 255, 255, 0.025));
  border-color: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
  border-style: solid;
  border-width: 1px;
  border-radius: 8px;
}

.network-group h4 {
  margin: 0;
}

.network-group .active-network {
  text-transform: capitalize;
}

.network-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5em;
}

.wallet-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  margin-bottom: 2em;
}

.wallet-group h4 {
  margin: 0;
}

.wallet-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5em;
}

.input-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
}

.input-group label {
  margin-left: 1em;
  font-weight: 500;
}

.input-group input {
  min-width: 16em;
}

.input-group input[disabled] {
  opacity: 0.75;
  color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
}

@media (prefers-color-scheme: light) {
  .network-group {
    border-color: #f9f9f9;
  }
}
</style>
