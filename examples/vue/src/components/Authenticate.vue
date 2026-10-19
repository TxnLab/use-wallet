<script setup lang="ts">
import * as ed from '@noble/ed25519'
import {
  getSignDataScheme,
  ScopeType,
  SignDataError,
  useNetwork,
  useWallet,
  type Siwa
} from '@txnlab/use-wallet-vue'
import { Address, addressFromPQKey, FALCON_1024_SCHEME } from 'algosdk'
import { canonify } from 'canonify'
import { ref } from 'vue'

type TxnStatus = 'idle' | 'signing' | 'verified' | 'error'

const { activeAccount, activeAddress, algodClient, signData } = useWallet()
const { activeNetworkConfig } = useNetwork()
const status = ref<TxnStatus>('idle')
const error = ref<string | null>(null)

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

// A Falcon key must authorize the account: its address (or the account's auth
// address, if rekeyed) is derived from the key
async function verifyFalcon(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
  authAddr: Address
) {
  if (!addressFromPQKey(FALCON_1024_SCHEME, publicKey).address.equals(authAddr)) return false
  const { verifyCompressed } = await import('falcon-1024')
  try {
    return verifyCompressed(publicKey, signature, message)
  } catch {
    // verifyCompressed throws for an invalid signature
    return false
  }
}

const handleAuth = async () => {
  if (!activeAddress.value) return

  try {
    status.value = 'signing'

    const siwaRequest: Siwa = {
      domain: location.host,
      chain_id: activeNetworkConfig.value.caipChainId || 'algorand:localnet',
      account_address: activeAddress.value,
      type: getSignDataScheme(activeAccount.value?.emptySignature) ?? 'ed25519',
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
    const acctInfo = await algodClient.value.accountInformation(activeAddress.value).do()
    const authAddr = acctInfo.authAddr ?? Address.fromString(activeAddress.value)
    const enc = new TextEncoder()
    const clientDataJsonHash = await sha256(enc.encode(dataString))
    const authenticatorDataHash = await sha256(new Uint8Array(resp.authenticatorData))
    const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
    const verified =
      siwaRequest.type === 'falcon-1024-det'
        ? await verifyFalcon(resp.signer, resp.signature, toSign, authAddr)
        : await ed.verifyAsync(resp.signature, toSign, authAddr.publicKey)
    if (!verified) {
      throw new SignDataError('Verification Failed', 4300)
    }
    status.value = 'verified'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Authentication failed'
    status.value = 'error'
  }
}
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white p-6">
    <h3 class="text-sm font-semibold text-gray-900 mb-4">Authenticate</h3>
    <p class="text-sm text-gray-500 mb-4">Sign data to prove account ownership.</p>

    <button
      @click="handleAuth"
      :disabled="status === 'signing'"
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {{ status === 'signing' ? 'Signing...' : 'Authenticate' }}
    </button>

    <div
      v-if="status === 'verified'"
      class="mt-4 rounded-lg bg-green-50 border border-green-200 p-3"
    >
      <p class="text-sm font-medium text-green-800">Authentication successful</p>
    </div>

    <div
      v-if="status === 'error' && error"
      class="mt-4 rounded-lg bg-red-50 border border-red-200 p-3"
    >
      <p class="text-sm font-medium text-red-800">Authentication failed</p>
      <p class="mt-1 text-xs text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
