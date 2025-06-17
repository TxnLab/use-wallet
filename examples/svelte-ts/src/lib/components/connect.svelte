<script lang="ts">
  import * as ed from '@noble/ed25519'
  import {
    BaseWallet,
    ScopeType,
    SignDataError,
    useWallet,
    WalletId,
    type Siwa
  } from '@txnlab/use-wallet-svelte'
  import algosdk from 'algosdk'
  import { canonify } from 'canonify'

  const props = $props()
  const { activeAddress, algodClient, isWalletActive, isWalletConnected, transactionSigner } =
    useWallet()
  const wallet: BaseWallet = props.wallet

  const setActiveAccount = (event: Event, wallet: BaseWallet) => {
    const target = event.target as HTMLSelectElement
    wallet.setActiveAccount(target.value)
  }

  let magicEmail = $state('')
  const isMagicLink = () => wallet.id === WalletId.MAGIC
  const isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail)
  const isConnectDisabled = () => isWalletConnected(wallet.id) || (isMagicLink() && !isEmailValid())
  const getConnectArgs = () => (isMagicLink() ? { email: magicEmail } : undefined)

  let isSending = $state(false)
  async function sendTransaction() {
    try {
      const sender = activeAddress()
      if (!sender) {
        throw new Error('[App] No active account')
      }

      const atc = new algosdk.AtomicTransactionComposer()
      const suggestedParams = await algodClient().getTransactionParams().do()

      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: sender,
        receiver: sender,
        amount: 0,
        suggestedParams
      })

      atc.addTransaction({ txn: transaction, signer: transactionSigner })

      console.info(`[App] Sending transaction...`, transaction)

      isSending = true

      const result = await atc.execute(algodClient(), 4)

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
    const activeAddr = activeAddress()
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
      const resp = await wallet.signData(data, metadata)
      // verify signature
      const enc = new TextEncoder()
      const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
      const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)
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
    {#if isWalletActive(wallet.id)}<span>[active]</span>{/if}
  </h4>
  <div class="wallet-buttons">
    <button onclick={() => wallet.connect(getConnectArgs())} disabled={isConnectDisabled()}>
      Connect
    </button>
    <button onclick={wallet.disconnect} disabled={!isWalletConnected(wallet.id)}>
      Disconnect
    </button>
    {#if !isWalletActive(wallet.id)}
      <button
        onclick={wallet.setActive}
        disabled={!isWalletConnected(wallet.id) || isWalletActive(wallet.id)}
      >
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
        disabled={isWalletConnected(wallet.id)}
      />
    </div>
  {/if}
  {#if isWalletActive(wallet.id) && wallet.accounts.length}
    <div>
      <select value={activeAddress()} onchange={(event) => setActiveAccount(event, wallet)}>
        {#each wallet.accounts as account}
          <option>
            {account.address}
          </option>
        {/each}
      </select>
    </div>
  {/if}
</div>
