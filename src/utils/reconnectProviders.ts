import { clearAccounts } from './clearAccounts'
import { isActiveProvider } from './providers'
import type { SupportedProviders } from '../types'

export const reconnectProviders = async (providers: SupportedProviders) => {
  try {
    const clients = Object.values(providers)

    for (const client of clients) {
      const id = client?.metadata.id

      // Only reconnect to active providers
      if (id && isActiveProvider(id)) {
        await client.reconnect(() => clearAccounts(id))
      }
    }
  } catch (e) {
    console.error(e)
  }
}
