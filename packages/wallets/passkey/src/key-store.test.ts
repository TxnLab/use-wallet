import { WorkerKeyStore } from './key-store'
import type { WorkerRequest, WorkerResponse } from './worker/protocol'

const PUBLIC_KEY = new Uint8Array([7, 7, 7])

/** Stands in for the module worker: answers `ready`, then every request */
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((event: Partial<ErrorEvent>) => void) | null = null
  requests: WorkerRequest[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
    queueMicrotask(() => this.emit({ type: 'ready' }))
  }

  postMessage(request: WorkerRequest) {
    this.requests.push(request)
    queueMicrotask(() => this.emit({ type: 'result', id: request.id, ok: true, value: PUBLIC_KEY }))
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
