import { PasskeyError } from './errors'
import type { WorkerRequest, WorkerResponse } from './worker/protocol'

/**
 * Holds the Falcon-1024 private key between a passkey's PRF ceremony and the
 * signatures it authorizes. The adapter's built-in key store runs the key in a
 * dedicated worker; supply your own (the `keyStore` option) to hold it
 * elsewhere, e.g. a SharedWorker that outlives a page reload.
 */
export interface PasskeyKeyStore {
  /** True when `sign` can run without a new PRF ceremony */
  readonly unlocked: boolean
  /**
   * Derive the key from the passkey's 32-byte PRF output and return its
   * Falcon-1024 public key. Implementations must zero `entropy` and derive the
   * keygen seed with `keygenSeedFromEntropy`.
   */
  unlock(entropy: Uint8Array): Promise<Uint8Array>
  /** Sign exactly these bytes with the private key */
  sign(bytes: Uint8Array): Promise<Uint8Array>
  /** Drop the private key */
  lock(): void
}

export interface WorkerKeyStoreOptions {
  /** Clear the key after this long without a signature. 0 keeps it until `lock`. */
  idleTimeoutMs?: number
  /** Called when the idle timeout clears the key */
  onIdleLock?: () => void
  /** How long to wait for the worker to load. Default: 10000 */
  startTimeoutMs?: number
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * The built-in key store: a dedicated module worker started from a Blob URL.
 * The worker module is inlined into this package, so a consumer's bundler has
 * no worker entry to resolve; the page's CSP must allow `worker-src blob:` and
 * `'wasm-unsafe-eval'`. `lock` terminates the worker, which drops its WASM
 * heap.
 */
export class WorkerKeyStore implements PasskeyKeyStore {
  private worker: Worker | null = null
  private isUnlocked = false
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >()

  constructor(private readonly options: WorkerKeyStoreOptions = {}) {}

  get unlocked(): boolean {
    return this.isUnlocked
  }

  async unlock(entropy: Uint8Array): Promise<Uint8Array> {
    // Copy into a buffer the worker takes ownership of, then zero the caller's
    const buffer = new Uint8Array(entropy).buffer
    entropy.fill(0)

    this.lock()
    try {
      this.worker = await this.start()
      const publicKey = await this.call<Uint8Array>(
        { op: 'unlock', entropy: buffer, idleTimeoutMs: this.options.idleTimeoutMs },
        [buffer]
      )
      this.isUnlocked = true
      return publicKey
    } catch (error) {
      new Uint8Array(buffer).fill(0)
      this.lock()
      throw error
    }
  }

  sign(bytes: Uint8Array): Promise<Uint8Array> {
    if (!this.isUnlocked) {
      return Promise.reject(
        new PasskeyError('key-store-failed', 'The passkey key store is locked.')
      )
    }
    return this.call<Uint8Array>({ op: 'sign', bytes })
  }

  lock(): void {
    this.isUnlocked = false
    if (!this.worker) return
    this.worker.terminate()
    this.worker = null
    const error = new PasskeyError('key-store-failed', 'The passkey key store was locked.')
    for (const { reject } of this.pending.values()) reject(error)
    this.pending.clear()
  }

  private async start(): Promise<Worker> {
    // Loaded lazily, after the passkey ceremony, so it never sits between a
    // user's tap and navigator.credentials
    const { WORKER_SOURCE } = await import('./worker/source.generated')
    const { startTimeoutMs = 10000 } = this.options
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }))

    return new Promise<Worker>((resolve, reject) => {
      let worker: Worker
      try {
        worker = new Worker(url, { type: 'module', name: 'use-wallet-passkey' })
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(this.startError(error))
        return
      }

      const done = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
      }
      const timer = setTimeout(() => {
        done()
        worker.terminate()
        reject(
          new PasskeyError(
            'key-store-failed',
            `The passkey key worker did not start within ${startTimeoutMs} ms.`
          )
        )
      }, startTimeoutMs)

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type !== 'ready') return
        done()
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(event.data)
        worker.onerror = (event) => {
          event.preventDefault()
          this.lock()
        }
        resolve(worker)
      }
      worker.onerror = (event) => {
        // Keep the load failure from also surfacing as an uncaught page error
        event.preventDefault()
        done()
        worker.terminate()
        reject(this.startError(event.message))
      }
    })
  }

  private startError(cause: unknown): PasskeyError {
    const detail = cause instanceof Error ? cause.message : cause ? String(cause) : ''
    return new PasskeyError(
      'key-store-failed',
      "The passkey key worker failed to start. If the page has a Content Security Policy, it must allow worker-src blob: and script-src 'wasm-unsafe-eval'." +
        (detail ? ` (${detail})` : ''),
      { cause }
    )
  }

  private call<T>(
    request: DistributiveOmit<WorkerRequest, 'id'>,
    transfer: Transferable[] = []
  ): Promise<T> {
    const worker = this.worker
    if (!worker) {
      return Promise.reject(
        new PasskeyError('key-store-failed', 'The passkey key store is locked.')
      )
    }
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ ...request, id }, transfer)
    })
  }

  private handle(message: WorkerResponse): void {
    if (message.type === 'locked') {
      this.lock()
      this.options.onIdleLock?.()
      return
    }
    if (message.type !== 'result') return
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    if (message.ok) entry.resolve(message.value)
    else entry.reject(new PasskeyError('key-store-failed', message.error))
  }
}
