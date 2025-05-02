<script setup lang="ts">
import {
  ScopeType,
  SignDataError,
  Siwa,
  WalletId,
  useWallet,
  type Wallet
} from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'
import libsodium from 'libsodium-wrappers-sumo'
import { ref } from 'vue'

const { activeAddress, algodClient, transactionSigner, signData, wallets } = useWallet()

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

const sendTransaction = async () => {
  if (!activeAddress.value) {
    throw new Error('[App] No active account')
  }

  isSending.value = true

  try {
    const atc = new algosdk.AtomicTransactionComposer()
    const suggestedParams = await algodClient.value.getTransactionParams().do()

    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAddress.value,
      receiver: activeAddress.value,
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

const auth = async () => {
  if (!activeAddress.value) {
    throw new Error('[App] No active account')
  }

  try {
    const date = new Date()
    const nowIso = date.toISOString()
    date.setMonth(date.getMonth() + 2)
    const expIso = date.toISOString()
    const sender = algosdk.Address.fromString(activeAddress.value)
    const siwxRequest: Siwa = {
      domain: location.host,
      chain_id: '283',
      account_address: sender.toString(),
      type: 'ed25519',
      uri: location.origin,
      version: '1',
      'expiration-time': expIso,
      'not-before': nowIso,
      'issued-at': nowIso
    }

    const dataString = JSON.stringify(siwxRequest)

    const data = btoa(dataString)
    const metadata = {
      scope: ScopeType.AUTH,
      encoding: 'base64'
    }

    const resp = await signData(data, metadata)

    // verify signature
    const enc = new TextEncoder()
    const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
    const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)

    const toSign = new Uint8Array(64)
    toSign.set(new Uint8Array(clientDataJsonHash), 0)
    toSign.set(new Uint8Array(authenticatorDataHash), 32)

    await libsodium.ready
    if (!libsodium.crypto_sign_verify_detached(resp.signature, toSign, sender.publicKey)) {
      throw new SignDataError('Verification Failed', 4300)
    }
    console.info(`[App] ✅ Successfully authenticated!`)
  } catch (error) {
    console.error('[App] Error signing data:', error)
  }
}
</script>

<template>
  <div v-for="wallet in wallets" :key="wallet.id" class="wallet-group">
    <h4>{{ wallet.metadata.name }} <span v-if="wallet.isActive">[active]</span></h4>
    <div class="wallet-buttons">
      <button @click="wallet.connect(getConnectArgs(wallet))" :disabled="isConnectDisabled(wallet)">
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
      <template v-else>
        <button @click="sendTransaction()" :disabled="isSending">
          {{ isSending ? 'Sending Transaction...' : 'Send Transaction' }}
        </button>
        <button v-if="wallet.canSignData" @click="auth()">Authenticate</button>
      </template>
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
        <option v-for="account in wallet.accounts" :key="account.address" :value="account.address">
          {{ account.address }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
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
