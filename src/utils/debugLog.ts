import { ProviderConfig, ProviderConfigMapping } from '../types'
import { useDebugStore } from '../store/index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debugLog = (...args: any[]) => {
  const { debug } = useDebugStore.getState()

  if (debug) {
    console.log('%c[USE-WALLET]', 'color: #FF602E; font-weight: bold;', ...(args as unknown[]))
  }
}

export const getProviderList = <T extends keyof ProviderConfigMapping>(
  providers: Array<T | ProviderConfig<T>>
) => {
  return providers
    .map((provider) => {
      if (typeof provider === 'string') {
        return provider
      }

      return provider.id
    })
    .map((id) => id.toUpperCase())
    .join(', ')
}
