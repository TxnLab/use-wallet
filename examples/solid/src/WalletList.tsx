import { useWallet, type Wallet } from '@txnlab/use-wallet-solid'
import { createSignal, For, Show } from 'solid-js'

export function WalletList() {
  const { availableWallets } = useWallet()
  const [connecting, setConnecting] = createSignal<string | null>(null)

  const handleConnect = async (wallet: Wallet) => {
    try {
      setConnecting(wallet.id)
      await wallet.connect()
    } catch (error) {
      console.error(`Failed to connect ${wallet.metadata.name}:`, error)
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div class="space-y-2">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Wallets</h2>
      <For each={availableWallets()}>
        {(wallet) => (
          <WalletRow
            wallet={wallet}
            isConnecting={connecting() === wallet.id}
            onConnect={() => handleConnect(wallet)}
          />
        )}
      </For>
    </div>
  )
}

function WalletRow(props: { wallet: Wallet; isConnecting: boolean; onConnect: () => void }) {
  return (
    <div
      class={`rounded-xl border p-3 transition-colors ${
        props.wallet.isActive
          ? 'border-blue-200 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div class="flex items-center gap-3">
        <img
          src={props.wallet.metadata.icon}
          alt={props.wallet.metadata.name}
          class="h-10 w-10 rounded-lg shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900">{props.wallet.metadata.name}</div>
          <Show when={props.wallet.isConnected && props.wallet.activeAccount}>
            <div class="text-xs text-gray-400 truncate font-mono">
              {props.wallet.activeAccount!.address.slice(0, 8)}...
              {props.wallet.activeAccount!.address.slice(-4)}
            </div>
          </Show>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <Show
            when={props.wallet.isConnected}
            fallback={
              <button
                onClick={props.onConnect}
                disabled={props.isConnecting}
                class="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {props.isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            }
          >
            <Show when={!props.wallet.isActive}>
              <button
                onClick={() => props.wallet.setActive()}
                class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Activate
              </button>
            </Show>
            <button
              onClick={() => props.wallet.disconnect()}
              class="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-100 transition-colors"
            >
              Disconnect
            </button>
          </Show>
        </div>
      </div>
    </div>
  )
}
