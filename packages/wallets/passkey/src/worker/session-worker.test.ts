import algosdk from 'algosdk'
import type { WorkerRequest, WorkerResponse } from './protocol'

// hayai-client's PRF_VECTOR and the Falcon account it derives
const PRF_VECTOR = '0123456789abcdef1032547698badcfedeadbeefcafebabefeedface00112233'
const ADDRESS = 'EIPP4HVON56N55A54OTPEXDTGXYKEMPH5UVTNKJZZNLQ6DAZW5DO2YN54A'

type Request = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

let posted: WorkerResponse[]
let scope: {
  postMessage: (message: WorkerResponse) => void
  onmessage: ((event: any) => void) | null
}
let nextId: number

/** Run the worker module against a fake `self`, as a fresh module each time */
async function loadWorker() {
  posted = []
  nextId = 1
  scope = { postMessage: (message) => posted.push(message), onmessage: null }
  vi.stubGlobal('self', scope)
  vi.resetModules()
  await import('./session-worker')
}

/** Send a request; the worker answers synchronously */
function send(request: Request): WorkerResponse {
  const id = nextId++
  scope.onmessage!({ data: { ...request, id } })
  const response = posted.at(-1)!
  expect(response).toMatchObject({ type: 'result', id })
  return response
}

function unlock(options: { idleTimeoutMs?: number; maxAgeMs?: number } = {}): Uint8Array {
  const entropy = new Uint8Array(Buffer.from(PRF_VECTOR, 'hex')).buffer
  const response = send({ op: 'unlock', entropy, ...options })
  if (response.type !== 'result' || !response.ok) throw new Error('unlock failed')
  return response.value as Uint8Array
}

const sign = () => send({ op: 'sign', bytes: new Uint8Array([1, 2, 3]) })
const locks = () => posted.filter((message) => message.type === 'locked')

describe('session worker', () => {
  beforeEach(async () => {
    await loadWorker()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('announces itself and derives the account key', () => {
    expect(posted[0]).toEqual({ type: 'ready' })
    const publicKey = unlock()
    const { address } = algosdk.addressFromPQKey(algosdk.FALCON_1024_SCHEME, publicKey)
    expect(address.toString()).toBe(ADDRESS)
    expect(sign()).toMatchObject({ ok: true })
  })

  it('locks after the idle timeout, and each signature restarts it', () => {
    unlock({ idleTimeoutMs: 1000 })
    vi.advanceTimersByTime(900)
    sign()
    vi.advanceTimersByTime(900)
    expect(locks()).toHaveLength(0)

    vi.advanceTimersByTime(100)
    expect(locks()).toEqual([{ type: 'locked', reason: 'idle' }])
    expect(sign()).toMatchObject({ ok: false, error: 'locked' })
  })

  it('locks at the maximum age, however often it signs', () => {
    unlock({ idleTimeoutMs: 1000, maxAgeMs: 2500 })
    for (let elapsed = 0; elapsed < 2400; elapsed += 800) {
      vi.advanceTimersByTime(800)
      expect(sign()).toMatchObject({ ok: true })
    }
    expect(locks()).toHaveLength(0)

    vi.advanceTimersByTime(100)
    expect(locks()).toEqual([{ type: 'locked', reason: 'max-age' }])
    expect(sign()).toMatchObject({ ok: false, error: 'locked' })

    // The idle timer was cleared with the key, so it doesn't report a second lock
    vi.advanceTimersByTime(5000)
    expect(locks()).toHaveLength(1)
  })

  it('restarts the maximum age on a new unlock', () => {
    unlock({ maxAgeMs: 1000 })
    vi.advanceTimersByTime(800)
    unlock({ maxAgeMs: 1000 })
    vi.advanceTimersByTime(800)
    expect(locks()).toHaveLength(0)

    vi.advanceTimersByTime(200)
    expect(locks()).toEqual([{ type: 'locked', reason: 'max-age' }])
  })

  it('sets no limit when both timeouts are 0', () => {
    unlock({ idleTimeoutMs: 0, maxAgeMs: 0 })
    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(locks()).toHaveLength(0)
    expect(sign()).toMatchObject({ ok: true })
  })

  it('clears both timers on lock', () => {
    unlock({ idleTimeoutMs: 1000, maxAgeMs: 2000 })
    expect(send({ op: 'lock' })).toMatchObject({ ok: true, value: true })
    vi.advanceTimersByTime(5000)
    expect(locks()).toHaveLength(0)
    expect(sign()).toMatchObject({ ok: false, error: 'locked' })
  })
})
