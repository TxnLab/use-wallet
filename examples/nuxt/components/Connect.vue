<script setup lang="ts">
import * as ed from '@noble/ed25519'
import {
  NetworkId,
  ScopeType,
  SignDataError,
  WalletId,
  useNetwork,
  useWallet,
  type Siwa,
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
} from '~/firebase'

const { activeAddress, algodClient, signData, transactionSigner, wallets: walletsRef } = useWallet()
const wallets = computed(() => walletsRef.value)

const { activeNetwork, setActiveNetwork } = useNetwork()

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
    alert('No active account')
    return
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
    alert('No active account')
    return
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
  <section>
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
      <h4 :data-active="wallet.isActive">
        {{ wallet.metadata.name }}
      </h4>
      <div class="wallet-buttons">
        <button
          @click="handleConnect(wallet)"
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
  </section>
</template>

<style scoped>
section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.5;
}

.network-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  margin: 2em;
  padding: 2em;
  background-color: rgba(255, 255, 255, 0.025);
  border-color: rgba(255, 255, 255, 0.1);
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

.wallet-group h4[data-active='true']:after {
  content: ' [active]';
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
  color: rgba(255, 255, 255, 0.3);
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  color: white;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:not(:disabled):hover {
  border-color: #00dc82;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}
button:disabled {
  opacity: 0.75;
  cursor: default;
  color: #999;
}

input[type='text'],
input[type='email'],
input[type='password'] {
  border-radius: 8px;
  border: 1px solid #1a1a1a;
  padding: 0.6em 0.9em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: #ffffff;
  transition: border-color 0.25s;
}

select {
  border-radius: 8px;
  border: 1px solid #1a1a1a;
  padding: 0.6em 0.9em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: #ffffff;
  transition: border-color 0.25s;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  -moz-appearance: none !important;
  -webkit-appearance: none !important;
  appearance: none !important;
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
  button {
    background-color: #f9f9f9;
    border-color: #cacaca;
    color: #1a1a1a;
  }
  button:disabled {
    border-color: #dddddd;
  }
  input[type='text'],
  input[type='email'],
  input[type='password'],
  select {
    background-color: #f9f9f9;
    color: #000000;
    border-color: #cacaca;
  }

  .input-group input[disabled] {
    opacity: 0.75;
    color: rgba(16, 16, 16, 0.3);
  }

  .network-group {
    background-color: rgba(0, 0, 0, 0.025);
    border-color: rgba(0, 0, 0, 0.1);
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
