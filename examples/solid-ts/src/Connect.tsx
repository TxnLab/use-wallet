import { useWallet, type BaseWallet } from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'
import { For, Show, createSignal } from 'solid-js'

export function Connect() {
  const [isSending, setIsSending] = createSignal(false)
  const {
    algodClient,
    activeAddress,
    activeWalletId,
    isWalletActive,
    isWalletConnected,
    transactionSigner,
    wallets
  } = useWallet()

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
        from: sender,
        to: sender,
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
      <For each={wallets}>
        {(wallet) => (
          <div>
            <h4>
              {wallet.metadata.name}{' '}
              <Show when={wallet.id === activeWalletId()} fallback="">
                [active]
              </Show>
            </h4>
            <div class="wallet-buttons">
              <button
                type="button"
                onClick={() => wallet.connect()}
                disabled={isWalletConnected(wallet.id)}
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
              <Show when={wallet.id === activeWalletId()}>
                <button type="button" onClick={sendTransaction} disabled={isSending()}>
                  {isSending() ? 'Sending Transaction...' : 'Send Transaction'}
                </button>
              </Show>
              <button
                type="button"
                onClick={() => wallet.setActive()}
                disabled={isWalletActive(wallet.id) || !isWalletConnected(wallet.id)}
              >
                Set Active
              </button>
            </div>

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