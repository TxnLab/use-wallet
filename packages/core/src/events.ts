import type { WalletAccount } from 'src/wallets/types'

// ---------- Event Types -------------------------------------------- //

/**
 * Events emitted by WalletManager. Signing interception events
 * (beforeSign/afterSign) are planned for v5.1+.
 */
export type WalletManagerEvents = {
  ready: void
  walletConnected: { walletId: string; accounts: WalletAccount[] }
  walletDisconnected: { walletId: string }
  activeWalletChanged: { walletId: string | null }
  activeAccountChanged: { walletId: string; address: string }
  networkChanged: { networkId: string }
  error: { walletId?: string; error: Error }
}

// ---------- Event Emitter ------------------------------------------ //

type EventHandler<T> = (payload: T) => void
type EventUnsubscribe = () => void

/**
 * Lightweight typed event emitter for WalletManager.
 * Events are fire-and-forget (observation only). Async interception
 * (middleware) is planned for v5.1+.
 */
export class EventEmitter<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<EventHandler<any>>>()

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): EventUnsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)

    return () => {
      this.listeners.get(event)?.delete(handler)
    }
  }

  emit<K extends keyof TEvents>(
    event: K,
    ...args: TEvents[K] extends void ? [] : [payload: TEvents[K]]
  ): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return

    for (const handler of handlers) {
      try {
        handler(args[0])
      } catch {
        // Fire-and-forget: handler errors are silently swallowed.
        // Consumers should handle their own errors.
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}
