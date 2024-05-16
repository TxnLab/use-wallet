import { NetworkId, useWallet } from '@txnlab/use-wallet-solid'
import { For, Show } from 'solid-js'
import encoding from 'algosdk'

export function Connect() {
  const {
    activeAccount,
    activeAddress,
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeWalletId,
    activeWalletState,
    algodClient,
    isWalletActive,
    isWalletConnected,
    setActiveNetwork,
    wallets
  } = useWallet()

  return (
    <div>
      <For each={wallets}>
        {(wallet) => (
          <div>
            <p>{wallet.id}</p>
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
                <p>wallet.id: {wallet.id}</p>
                <p>wallet.metadata: {wallet.metadata.name}</p>
                <span>wallet.icon: </span>
                <img src={wallet.metadata.icon} height={24} width={24} />
                <p>wallet.activeAccount: {wallet.activeAccount?.name}</p>
                <p>wallet.accounts: {JSON.stringify(wallet.accounts)}</p>
              </div>
            </Show>
          </div>
        )}
      </For>
      <button onClick={() => setActiveNetwork(NetworkId.MAINNET)}>Set Mainnet</button>
      <button onClick={() => setActiveNetwork(NetworkId.TESTNET)}>Set Testnet</button>
      <p>activeNetwork: {activeNetwork().toString()}</p>
      <p>activeWalletId: {activeWalletId()}</p>
      <p>activeWallet: {activeWallet()?.metadata.name}</p>
      <p>activeWalletAccounts: {JSON.stringify(activeWalletAccounts())}</p>
      <p>activeWalletAddresses: {activeWalletAddresses()?.join(', ')}</p>
      <p>activeWalletState: {JSON.stringify(activeWalletState())}</p>
      <p>activeAccount: {JSON.stringify(activeAccount())}</p>
      <p>activeAddress: {activeAddress()}</p>
      <p>algodClient int encoding: {algodClient().getIntEncoding()}</p>
      <button onClick={() => algodClient().setIntEncoding(encoding.IntDecoding.SAFE)}>
        Set Int encoding
      </button>
    </div>
  )
}
