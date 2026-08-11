import { useNetwork } from '@txnlab/use-wallet-solid'
import { For } from 'solid-js'

export function NetworkSwitch() {
  const { activeNetwork, networkConfig, setActiveNetwork } = useNetwork()

  return (
    <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      <For each={Object.keys(networkConfig())}>
        {(networkId) => (
          <button
            onClick={() => setActiveNetwork(networkId)}
            class={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              networkId === activeNetwork()
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {networkId}
          </button>
        )}
      </For>
    </div>
  )
}
