import { WorkerKeyStore } from './key-store'
import type { WorkerRequest, WorkerResponse } from './worker/protocol'

const PUBLIC_KEY = new Uint8Array([7, 7, 7])

/** Stands in for the module worker: answers `ready`, then every request */
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((event: Partial<ErrorEvent>) => void) | null = null
  /** Answer every request with this error */
  static failWith: string | undefined
  /** Answer no request */
  static silent = false
  /** Fail to start, as a CSP that blocks the worker does */
  static blocked = false
  requests: WorkerRequest[] = []
  terminated = false

  constructor() {
    if (FakeWorker.blocked) throw new Error('blocked by CSP')
    FakeWorker.instances.push(this)
    queueMicrotask(() => this.emit({ type: 'ready' }))
  }

  postMessage(message: WorkerRequest, transfer: Transferable[] = []) {
    // As a real worker does: what's transferred is detached on the page's side
    const request = structuredClone(message, { transfer })
    this.requests.push(request)
    if (FakeWorker.silent) return
    const { failWith } = FakeWorker
    queueMicrotask(() =>
      this.emit(
        failWith
          ? { type: 'result', id: request.id, ok: false, error: failWith }
          : { type: 'result', id: request.id, ok: true, value: PUBLIC_KEY }
      )
    )
  }

  emit(message: WorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>)
  }

  terminate() {
    this.terminated = true
  }
}

describe('WorkerKeyStore', () => {
  beforeEach(() => {
    FakeWorker.instances.length = 0
    FakeWorker.failWith = undefined
    FakeWorker.silent = false
    FakeWorker.blocked = false
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends both timeouts with the unlock and zeroes the entropy', async () => {
    const store = new WorkerKeyStore({ idleTimeoutMs: 1000, maxAgeMs: 5000 })
    const entropy = new Uint8Array(32).fill(1)

    await expect(store.unlock(entropy)).resolves.toEqual(PUBLIC_KEY)
    expect(store.unlocked).toBe(true)
    expect(entropy.every((byte) => byte === 0)).toBe(true)
    expect(FakeWorker.instances[0].requests[0]).toMatchObject({
      op: 'unlock',
      idleTimeoutMs: 1000,
      maxAgeMs: 5000
    })
  })

  it('hands the entropy over to the worker', async () => {
    const store = new WorkerKeyStore()
    await store.unlock(new Uint8Array(32).fill(1))

    const [request] = FakeWorker.instances[0].requests
    expect(request.op === 'unlock' && new Uint8Array(request.entropy)).toEqual(
      new Uint8Array(32).fill(1)
    )
  })

  it('zeroes the entropy it still holds when the worker never starts', async () => {
    FakeWorker.blocked = true
    const entropy = new Uint8Array(32).fill(1)

    // Counts 32-byte buffers of the entropy as they're zeroed
    let zeroed = 0
    const fill = Uint8Array.prototype.fill
    const spy = vi.spyOn(Uint8Array.prototype, 'fill').mockImplementation(function (
      this: Uint8Array,
      ...args: Parameters<typeof fill>
    ) {
      if (args[0] === 0 && this.length === 32 && this.every((byte) => byte === 1)) zeroed++
      return fill.apply(this, args)
    })
    try {
      await expect(new WorkerKeyStore().unlock(entropy)).rejects.toMatchObject({
        name: 'PasskeyError',
        code: 'key-store-failed'
      })
    } finally {
      spy.mockRestore()
    }
    // The caller's bytes, and the copy that never reached the worker
    expect(zeroed).toBe(2)
    expect(FakeWorker.instances).toHaveLength(0)
  })

  // The entropy is with the worker by then, so there's nothing on the page to zero
  it('fails as the key store, and stops the worker, when the worker fails the unlock', async () => {
    FakeWorker.failWith = 'keygen failed'
    const store = new WorkerKeyStore()

    await expect(store.unlock(new Uint8Array(32).fill(1))).rejects.toMatchObject({
      name: 'PasskeyError',
      code: 'key-store-failed',
      message: 'keygen failed'
    })
    expect(store.unlocked).toBe(false)
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })

  it('fails as the key store when it locks while the worker derives the key', async () => {
    FakeWorker.silent = true
    const store = new WorkerKeyStore()
    const unlocking = store.unlock(new Uint8Array(32).fill(1))
    await vi.waitFor(() => expect(FakeWorker.instances[0]?.requests).toHaveLength(1))

    store.lock()
    await expect(unlocking).rejects.toMatchObject({
      name: 'PasskeyError',
      code: 'key-store-failed'
    })
    expect(store.unlocked).toBe(false)
    expect(FakeWorker.instances[0].terminated).toBe(true)
  })

  it.each(['idle', 'max-age'] as const)(
    'terminates the worker and reports a %s lock',
    async (reason) => {
      const onLock = vi.fn()
      const store = new WorkerKeyStore({ onLock })
      await store.unlock(new Uint8Array(32))

      FakeWorker.instances[0].emit({ type: 'locked', reason })
      expect(onLock).toHaveBeenCalledWith(reason)
      expect(store.unlocked).toBe(false)
      expect(FakeWorker.instances[0].terminated).toBe(true)
      await expect(store.sign(new Uint8Array([1]))).rejects.toMatchObject({
        code: 'key-store-failed'
      })
    }
  )

  it('reports a worker failure, but not an explicit lock', async () => {
    const onLock = vi.fn()
    const store = new WorkerKeyStore({ onLock })
    await store.unlock(new Uint8Array(32))
    FakeWorker.instances[0].onerror!({ preventDefault: () => {} })
    expect(onLock).toHaveBeenCalledWith('key-store')
    expect(store.unlocked).toBe(false)

    await store.unlock(new Uint8Array(32))
    store.lock()
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})
