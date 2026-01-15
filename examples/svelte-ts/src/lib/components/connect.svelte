<script lang="ts">
  import * as ed from '@noble/ed25519'
  import {
    ScopeType,
    SignDataError,
    useWallet,
    WalletId,
    type Siwa,
    type Wallet
  } from '@txnlab/use-wallet-svelte'
  import algosdk from 'algosdk'
  import { canonify } from 'canonify'

  const props = $props()
  const { activeAddress, algodClient, signData, transactionSigner } = useWallet()
  const wallet: Wallet = props.wallet

  const setActiveAccount = (event: Event, wallet: Wallet) => {
    const target = event.target as HTMLSelectElement
    wallet.setActiveAccount(target.value)
  }

  let magicEmail = $state('')
  const isMagicLink = () => wallet.id === WalletId.MAGIC
  const isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail)

  const isConnectDisabled = () => {
    if (wallet.isConnected()) {
      return true
    }
    if (isMagicLink() && !isEmailValid()) {
      return true
    }
    return false
  }

  async function handleConnect() {
    if (isMagicLink()) {
      await wallet.connect({ email: magicEmail })
    } else {
      await wallet.connect()
    }
  }

  let isSending = $state(false)
  async function sendTransaction() {
    try {
      const sender = activeAddress.current
      if (!sender) {
        throw new Error('[App] No active account')
      }

      const atc = new algosdk.AtomicTransactionComposer()
      const suggestedParams = await algodClient.current.getTransactionParams().do()

      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: sender,
        receiver: sender,
        amount: 0,
        suggestedParams
      })

      atc.addTransaction({ txn: transaction, signer: transactionSigner })

      console.info(`[App] Sending transaction...`, transaction)

      isSending = true

      const result = await atc.execute(algodClient.current, 4)

      console.info(`[App] ✅ Successfully sent transaction!`, {
        confirmedRound: result.confirmedRound,
        txIDs: result.txIDs
      })
    } catch (error) {
      console.error('[App] Error signing transaction:', error)
    } finally {
      isSending = false
    }
  }
  async function auth() {
    const activeAddr = activeAddress.current
    if (!activeAddr) {
      throw new Error('[App] No active account')
    }
    try {
      const siwaRequest: Siwa = {
        domain: location.host,
        chain_id: '283',
        account_address: activeAddr,
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
      const authenticatorDataHash = await crypto.subtle.digest('SHA-256', new Uint8Array(resp.authenticatorData))
      const toSign = new Uint8Array(64)
      toSign.set(new Uint8Array(clientDataJsonHash), 0)
      toSign.set(new Uint8Array(authenticatorDataHash), 32)
      const pubKey = algosdk.Address.fromString(activeAddr).publicKey
      if (!(await ed.verifyAsync(resp.signature, toSign, pubKey))) {
        throw new SignDataError('Verification Failed', 4300)
      }
      console.info(`[App] ✅ Successfully authenticated!`)
    } catch (error) {
      console.error('[App] Error signing data:', error)
    }
  }
</script>

<div class="wallet-group">
  <h4>
    {wallet.metadata.name}
    {#if wallet.isActive()}<span>[active]</span>{/if}
  </h4>
  <div class="wallet-buttons">
    <button onclick={handleConnect} disabled={isConnectDisabled()}>
      Connect
    </button>
    <button onclick={wallet.disconnect} disabled={!wallet.isConnected()}> Disconnect </button>
    {#if !wallet.isActive()}
      <button onclick={wallet.setActive} disabled={!wallet.isConnected() || wallet.isActive()}>
        Set Active
      </button>
    {:else}
      <button onclick={sendTransaction} disabled={isSending}>
        {isSending ? 'Sending Transaction...' : 'Send Transaction'}
      </button>
      {#if wallet.canSignData}
        <button onclick={auth}>Authenticate</button>
      {/if}
    {/if}
  </div>
  {#if isMagicLink()}
    <div class="input-group">
      <label for="magic-email">Email:</label>
      <input
        id="magic-email"
        type="email"
        bind:value={magicEmail}
        placeholder="Enter email to connect..."
        disabled={wallet.isConnected()}
      />
    </div>
  {/if}
  {#if wallet.isActive() && wallet.accounts.current?.length}
    <div>
      <select value={activeAddress.current} onchange={(event) => setActiveAccount(event, wallet)}>
        {#each wallet.accounts.current as account}
          <option>
            {account.address}
          </option>
        {/each}
      </select>
    </div>
  {/if}
</div>
