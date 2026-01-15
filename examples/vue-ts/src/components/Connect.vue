<script setup lang="ts">
import * as ed from '@noble/ed25519'
import {
  ScopeType,
  SignDataError,
  Siwa,
  WalletId,
  useWallet,
  type Wallet
} from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import { ref, onMounted, onUnmounted } from 'vue'
import {
  isFirebaseConfigured,
  firebaseSignOut,
  getFreshIdToken,
  onFirebaseAuthStateChanged,
  type User
} from '../firebase'
import FirebaseAuth from './FirebaseAuth.vue'

const { activeAddress, algodClient, transactionSigner, signData, wallets } = useWallet()

const isSending = ref(false)
const magicEmail = ref('')

// Firebase auth state
const firebaseUser = ref<User | null>(null)

// Auth state subscription
let unsubscribe: (() => void) | undefined

onMounted(() => {
  unsubscribe = onFirebaseAuthStateChanged((user) => {
    firebaseUser.value = user
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

const isMagicLink = (wallet: Wallet) => wallet.id === WalletId.MAGIC
const isWeb3Auth = (wallet: Wallet) => wallet.id === WalletId.WEB3AUTH
const isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail.value)

const isConnectDisabled = (wallet: Wallet) => {
  if (wallet.isConnected) return true
  if (isMagicLink(wallet) && !isEmailValid()) return true
  return false
}

// Firebase SFA connection
const handleFirebaseConnect = async (wallet: Wallet) => {
  if (!firebaseUser.value) {
    console.error('[App] No Firebase user signed in')
    return
  }

  const idToken = await getFreshIdToken()
  if (!idToken) {
    console.error('[App] Failed to get Firebase ID token')
    return
  }

  const verifierId = firebaseUser.value.uid
  console.info('[App] Connecting Web3Auth with Firebase auth...', { verifierId })

  await wallet.connect({ idToken, verifierId })
}

const handleConnect = async (wallet: Wallet) => {
  if (isMagicLink(wallet)) {
    await wallet.connect({ email: magicEmail.value })
  } else {
    await wallet.connect()
  }
}

const handleFirebaseSignOut = async () => {
  try {
    await firebaseSignOut()
    console.info('[App] Signed out from Firebase')
  } catch (error) {
    console.error('[App] Firebase sign-out error:', error)
  }
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
    const siwaRequest: Siwa = {
      domain: location.host,
      chain_id: '283',
      account_address: activeAddress.value,
      type: 'ed25519',
      uri: location.origin,
      version: '1',
      'issued-at': new Date().toISOString()
    }
    const dataString = canonify(siwaRequest)
    if (!dataString) throw Error('Invalid JSON')
    const data = btoa(dataString)
    const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
    const resp = await signData(data, metadata)
    // verify signature
    const enc = new TextEncoder()
    const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
    const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)
    const toSign = new Uint8Array(64)
    toSign.set(new Uint8Array(clientDataJsonHash), 0)
    toSign.set(new Uint8Array(authenticatorDataHash), 32)
    const pubKey = algosdk.Address.fromString(activeAddress.value).publicKey
    if (!(await ed.verifyAsync(resp.signature, toSign, pubKey))) {
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
      <button @click="handleConnect(wallet)" :disabled="isConnectDisabled(wallet)">
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

    <!-- Firebase SFA Authentication -->
    <div v-if="isWeb3Auth(wallet) && isFirebaseConfigured && !wallet.isConnected" class="firebase-sfa-section">
      <div class="section-divider">
        <span>or connect with Firebase</span>
      </div>
      <div v-if="firebaseUser" class="firebase-user">
        <span>Signed in as: {{ firebaseUser.email || firebaseUser.uid }}</span>
        <div class="firebase-user-buttons">
          <button type="button" @click="handleFirebaseSignOut">Sign Out</button>
          <button type="button" @click="handleFirebaseConnect(wallet)">Connect with Firebase</button>
        </div>
      </div>
      <div v-else class="firebase-auth">
        <FirebaseAuth
          :on-sign-in-success="() => console.info('[App] Firebase sign-in successful')"
        />
      </div>
    </div>
    <!-- End Firebase SFA Authentication -->

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

.firebase-user {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6em;
}

.firebase-user-buttons {
  display: flex;
  gap: 0.5em;
}

.firebase-user-buttons button {
  white-space: nowrap;
}

.firebase-user span {
  font-size: 0.9em;
  opacity: 0.8;
}

.firebase-auth {
  margin-top: 0.5em;
}

.firebase-sfa-section {
  width: 100%;
  max-width: 300px;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 1em;
  margin: 1em 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85em;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

@media (prefers-color-scheme: light) {
  .network-group {
    border-color: #f9f9f9;
  }

  .section-divider {
    color: rgba(0, 0, 0, 0.5);
  }

  .section-divider::before,
  .section-divider::after {
    background: rgba(0, 0, 0, 0.2);
  }
}
</style>
