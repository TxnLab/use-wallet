import * as ed from '@noble/ed25519'
import {
  ScopeType,
  SignDataError,
  Siwa,
  useWallet,
  WalletId,
  type BaseWallet
} from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import { For, Show, createSignal } from 'solid-js'

export function Connect() {
  const [isSending, setIsSending] = createSignal(false)
  const [magicEmail, setMagicEmail] = createSignal('')

  const {
    activeAddress,
    activeWalletId,
    isWalletActive,
    isWalletConnected,
    signData,
    transactionSigner,
    wallets,
    algodClient
  } = useWallet()

  const isMagicLink = (wallet: BaseWallet) => wallet.id === WalletId.MAGIC
  const isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail())

  const isConnectDisabled = (wallet: BaseWallet) => {
    if (isWalletConnected(wallet.id)) {
      return true
    }
    if (isMagicLink(wallet) && !isEmailValid()) {
      return true
    }
    return false
  }

  const handleConnect = async (wallet: BaseWallet) => {
    if (isMagicLink(wallet)) {
      await wallet.connect({ email: magicEmail() })
    } else {
      await wallet.connect()
    }
  }

  const setActiveAccount = (event: Event & { target: HTMLSelectElement }, wallet: BaseWallet) => {
    const target = event.target
    wallet.setActiveAccount(target.value)
  }

  const sendTransaction = async () => {
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

      setIsSending(true)

      const result = await atc.execute(algodClient(), 4)

      console.info(`[App] ✅ Successfully sent transaction!`, {
        confirmedRound: result.confirmedRound,
        txIDs: result.txIDs
      })
    } catch (error) {
      console.error('[App] Error signing transaction:', error)
    } finally {
      setIsSending(false)
    }
  }

  const auth = async () => {
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
      const resp = await signData(data, metadata)
      // verify signature
      const enc = new TextEncoder()
      const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
      const authenticatorDataHash = await crypto.subtle.digest(
        'SHA-256',
        new Uint8Array(resp.authenticatorData)
      )
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

  return (
    <For each={wallets}>
      {(wallet) => (
        <div class="wallet-group">
          <h4>
            {wallet.metadata.name}{' '}
            <Show when={wallet.id === activeWalletId()} fallback="">
              [active]
            </Show>
          </h4>
          <div class="wallet-buttons">
            <button
              type="button"
              onClick={() => handleConnect(wallet)}
              disabled={isConnectDisabled(wallet)}
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => wallet.disconnect()}
              disabled={!isWalletConnected(wallet.id)}
            >
              Disconnect
            </button>
            <Show when={isWalletActive(wallet.id)}>
              <button type="button" onClick={sendTransaction} disabled={isSending()}>
                {isSending() ? 'Sending Transaction...' : 'Send Transaction'}
              </button>
              <Show when={wallet.canSignData}>
                <button type="button" onClick={auth}>
                  Authenticate
                </button>
              </Show>
            </Show>
            <Show when={!isWalletActive(wallet.id)}>
              <button
                type="button"
                onClick={() => wallet.setActive()}
                disabled={!isWalletConnected(wallet.id)}
              >
                Set Active
              </button>
            </Show>
          </div>

          <Show when={isMagicLink(wallet)}>
            <div class="input-group">
              <label for="magic-email">Email:</label>
              <input
                id="magic-email"
                type="email"
                value={magicEmail()}
                onInput={(e) => setMagicEmail(e.target.value)}
                placeholder="Enter email to connect..."
                disabled={isWalletConnected(wallet.id)}
              />
            </div>
          </Show>

          <Show when={wallet.id === activeWalletId() && wallet.accounts.length}>
            <div>
              <select onChange={(event) => setActiveAccount(event, wallet)}>
                <For each={wallet.accounts}>
                  {(account) => <option value={account.address}>{account.address}</option>}
                </For>
              </select>
            </div>
          </Show>
        </div>
      )}
    </For>
  )
}
