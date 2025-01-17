import {
  useWallet,
  WalletId,
  NetworkId,
  useNetwork,
  type BaseWallet
} from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'
import { For, Show, createSignal } from 'solid-js'

export function Connect() {
  const [isSending, setIsSending] = createSignal(false)
  const [magicEmail, setMagicEmail] = createSignal('')

  const {
    activeAddress,
    activeWalletId,
    isWalletActive,
    isWalletConnected,
    transactionSigner,
    wallets
  } = useWallet()
  const { algodClient, activeNetwork, setActiveNetwork } = useNetwork()

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

  const getConnectArgs = (wallet: BaseWallet) => {
    if (isMagicLink(wallet)) {
      return { email: magicEmail() }
    }
    return undefined
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

  return (
    <div>
      <div class="network-group">
        <h4>
          Current Network: <span class="active-network">{activeNetwork()}</span>
        </h4>
        <div class="network-buttons">
          <button
            type="button"
            onClick={() => setActiveNetwork(NetworkId.BETANET)}
            disabled={activeNetwork() === NetworkId.BETANET}
          >
            Set to Betanet
          </button>
          <button
            type="button"
            onClick={() => setActiveNetwork(NetworkId.TESTNET)}
            disabled={activeNetwork() === NetworkId.TESTNET}
          >
            Set to Testnet
          </button>
          <button
            type="button"
            onClick={() => setActiveNetwork(NetworkId.MAINNET)}
            disabled={activeNetwork() === NetworkId.MAINNET}
          >
            Set to Mainnet
          </button>
        </div>
      </div>

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
                onClick={() => wallet.connect(getConnectArgs(wallet))}
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
    </div>
  )
}
