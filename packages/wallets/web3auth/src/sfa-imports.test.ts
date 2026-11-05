import { Web3AuthAdapter } from './adapter'
import { createTestHarness } from '@txnlab/use-wallet/testing'

// Kept apart from adapter.test.ts so no other test has loaded @web3auth/modal:
// each test file gets its own module registry, and a mock factory only runs on
// the first import of its module.
const loaded = vi.hoisted(() => ({ modal: false }))

vi.mock('@web3auth/modal', () => {
  loaded.modal = true
  return { Web3Auth: vi.fn() }
})

const mockProvider = {
  request: vi.fn(async () => 'a'.repeat(64))
}

const mockWeb3AuthSFA = {
  init: vi.fn(),
  connect: vi.fn(async () => mockProvider),
  logout: vi.fn(),
  connected: true,
  provider: mockProvider
}

vi.mock('@web3auth/single-factor-auth', () => ({
  Web3Auth: vi.fn(() => mockWeb3AuthSFA)
}))

vi.mock('@web3auth/base-provider', () => ({
  CommonPrivateKeyProvider: vi.fn(() => ({}))
}))

describe('Web3AuthAdapter Single Factor Auth imports', () => {
  beforeEach(() => {
    const localStorageStore: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key]
      })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connects with a custom JWT without loading @web3auth/modal', async () => {
    const { accessor } = createTestHarness('web3auth')
    const wallet = new Web3AuthAdapter({
      id: 'web3auth',
      metadata: Web3AuthAdapter.defaultMetadata,
      store: accessor,
      subscribe: vi.fn(),
      getAlgodClient: () => ({}) as any,
      options: { clientId: 'mock-client-id' }
    })

    const accounts = await wallet.connect({
      idToken: 'mock-firebase-id-token',
      verifierId: 'user@example.com',
      verifier: 'firebase-verifier'
    })

    expect(mockWeb3AuthSFA.connect).toHaveBeenCalled()
    expect(accounts).toHaveLength(1)
    expect(loaded.modal).toBe(false)
  })
})
