import { useWallet } from '@txnlab/use-wallet-solid'
import { For, Show } from 'solid-js'

export function Connect() {
  const { activeWalletId, isWalletActive, isWalletConnected, wallets } = useWallet()

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
                <select
                  onChange={(event) => {
                    const target = event.target
                    wallet.setActiveAccount(target?.value)
                  }}
                >
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
