import { Store } from '@tanstack/store'
import { logger } from 'src/logger'
import { WalletManager } from 'src/manager'
import {
  DEFAULT_STATE,
  LOCAL_STORAGE_KEY,
  PersistedState,
  State,
  addWallet,
  removeWallet,
  setAccounts,
  setActiveAccount,
  setActiveWallet
} from 'src/store'
import { StorageAdapter } from 'src/storage'
import type {
  InferWalletAccounts,
  Wallet,
  WalletAccount,
  WalletAdapterConfig
} from 'src/wallets/types'

vi.mock('src/logger', () => {
  const mockLogger = {
    createScopedLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
  return {
    Logger: {
      setLevel: vi.fn()
    },
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    },
    logger: mockLogger
  }
})

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

// Suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(logger.createScopedLogger).mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
})

// Custom account type extending WalletAccount with rich, optional extras
interface RichAccount extends WalletAccount {
  balance?: bigint
  type?: string
}

describe('Generic store mutations', () => {
  let store: Store<State<RichAccount>>

  const account1: RichAccount = {
    name: 'Rich Account 1',
    address: 'address1',
    balance: 1000n,
    type: 'keystore-account'
  }
  const account2: RichAccount = {
    name: 'Rich Account 2',
    address: 'address2'
  }

  beforeEach(() => {
    store = new Store<State<RichAccount>>(DEFAULT_STATE as State<RichAccount>)
  })

  it('accepts a Store<State<T>> with a custom account type', () => {
    addWallet(store, {
      walletId: 'custom',
      wallet: { accounts: [account1], activeAccount: account1 }
    })

    const wallet = store.state.wallets['custom']
    expect(wallet?.accounts).toEqual([account1])
    // Rich fields are statically typed, no casts needed
    expect(wallet?.accounts[0].balance).toBe(1000n)
    expect(wallet?.activeAccount?.type).toBe('keystore-account')
    expect(store.state.activeWallet).toBe('custom')
  })

  it('setAccounts preserves the custom account type', () => {
    addWallet(store, {
      walletId: 'custom',
      wallet: { accounts: [account1], activeAccount: account1 }
    })

    setAccounts(store, { walletId: 'custom', accounts: [account1, account2] })

    const wallet = store.state.wallets['custom']
    expect(wallet?.accounts).toEqual([account1, account2])
    expect(wallet?.activeAccount).toEqual(account1)
  })

  it('setActiveAccount and removeWallet operate on the generic store', () => {
    addWallet(store, {
      walletId: 'custom',
      wallet: { accounts: [account1, account2], activeAccount: account1 }
    })

    setActiveAccount(store, { walletId: 'custom', address: 'address2' })
    expect(store.state.wallets['custom']?.activeAccount).toEqual(account2)

    removeWallet(store, { walletId: 'custom' })
    expect(store.state.wallets['custom']).toBeUndefined()
    expect(store.state.activeWallet).toBeNull()
  })

  it('mutations preserve extra state fields (shape preservation)', () => {
    addWallet(store, {
      walletId: 'custom',
      wallet: { accounts: [account1], activeAccount: account1 }
    })
    setActiveWallet(store, { walletId: 'custom' })

    expect(store.state.activeNetwork).toBe(DEFAULT_STATE.activeNetwork)
    expect(store.state.algodClient).toBe(DEFAULT_STATE.algodClient)
    expect(store.state.networkConfig).toEqual(DEFAULT_STATE.networkConfig)
    expect(store.state.managerStatus).toBe(DEFAULT_STATE.managerStatus)
  })
})

describe('WalletManager with injected store', () => {
  it('adopts the injected store instance', () => {
    const store = new Store<State>(DEFAULT_STATE)
    const manager = new WalletManager({ options: { store } })

    expect(manager.store).toBe(store)
  })

  it('hydrates manager-derived state into the injected store', () => {
    const store = new Store<State>(DEFAULT_STATE)
    const manager = new WalletManager({ defaultNetwork: 'mainnet', options: { store } })

    expect(manager.store).toBe(store)
    expect(store.state.activeNetwork).toBe('mainnet')
    expect(store.state.networkConfig['mainnet']).toBeDefined()
    expect(store.state.algodClient).toBeDefined()
  })

  it('hydrates persisted state into the injected store like the private path', () => {
    const persistedAccount = { name: 'Persisted Account', address: 'persisted-address' }
    const persistedState: PersistedState = {
      wallets: {
        defly: { accounts: [persistedAccount], activeAccount: persistedAccount }
      },
      activeWallet: 'defly',
      activeNetwork: 'testnet',
      customNetworkConfigs: {}
    }
    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) =>
      key === LOCAL_STORAGE_KEY ? JSON.stringify(persistedState) : null
    )

    const store = new Store<State>(DEFAULT_STATE)
    new WalletManager({ options: { store } })

    // Persisted entry without a registered adapter is cleaned up, exactly
    // as it would be with a privately created store
    expect(store.state.wallets['defly']).toBeUndefined()
    expect(store.state.activeWallet).toBeNull()
  })

  it('keeps wallet entries written to the injected store before construction', () => {
    const account = { name: 'Extension Account', address: 'ext-address' }
    const store = new Store<State>({
      ...DEFAULT_STATE,
      wallets: {
        'provider-id': { accounts: [account], activeAccount: account }
      },
      activeWallet: 'provider-id'
    })

    const manager = new WalletManager({ options: { store } })

    // Externally owned keys are honored: hydration spreads the manager's
    // initial state over them and stale-wallet cleanup never touches keys
    // the manager did not hydrate itself
    expect(manager.store.state.wallets['provider-id']).toEqual({
      accounts: [account],
      activeAccount: account
    })
    expect(manager.store.state.activeWallet).toBe('provider-id')
  })

  it('live entries win over persisted entries on colliding wallet keys', () => {
    const persistedAccount = { name: 'Persisted Account', address: 'persisted-address' }
    const persistedState: PersistedState = {
      wallets: {
        'provider-id': { accounts: [persistedAccount], activeAccount: persistedAccount }
      },
      activeWallet: null,
      activeNetwork: 'testnet',
      customNetworkConfigs: {}
    }
    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) =>
      key === LOCAL_STORAGE_KEY ? JSON.stringify(persistedState) : null
    )

    const liveAccount = { name: 'Live Account', address: 'live-address' }
    const store = new Store<State>({
      ...DEFAULT_STATE,
      wallets: {
        'provider-id': { accounts: [liveAccount], activeAccount: liveAccount }
      },
      activeWallet: null
    })

    new WalletManager({ options: { store } })

    // A key that already exists in the store is owned by an outside writer;
    // the stale persisted entry neither replaces it nor marks it for cleanup
    expect(store.state.wallets['provider-id']).toEqual({
      accounts: [liveAccount],
      activeAccount: liveAccount
    })
  })

  it('keeps wallet entries written to the injected store after construction', () => {
    const store = new Store<State>(DEFAULT_STATE)
    const manager = new WalletManager({ options: { store } })

    // e.g. a wallet-provider extension writing under its own wallet key
    const account = { name: 'Extension Account', address: 'ext-address' }
    addWallet(store, {
      walletId: 'provider-id',
      wallet: { accounts: [account], activeAccount: account }
    })

    // Stale-wallet cleanup only runs during construction, so entries written
    // afterwards are untouched by the manager
    expect(manager.store.state.wallets['provider-id']).toEqual({
      accounts: [account],
      activeAccount: account
    })
    expect(manager.store.state.activeWallet).toBe('provider-id')
  })

  it('falls back to creating a private store when none is injected', () => {
    const manager = new WalletManager()
    expect(manager.store).toBeInstanceOf(Store)
    expect(manager.store.state.wallets).toEqual({})
  })
})

// ---------- Downstream account narrowing ---------------------------- //

// A single wallet's `accounts` can be a mix of unique account types that
// only share the base `WalletAccount` shape (name/address). Any per-type
// extras live off the common base, so consumers recast/narrow individually.
interface QuantumAccount extends WalletAccount {
  kind: 'quantum'
  handleQuantumOperation: () => string
}

interface ClassicAccount extends WalletAccount {
  kind: 'classic'
  legacyId: number
}

// User-defined type guards operating on the open base type
function isQuantumAccount(account: WalletAccount): account is QuantumAccount {
  return (account as Partial<QuantumAccount>).kind === 'quantum'
}

function isClassicAccount(account: WalletAccount): account is ClassicAccount {
  return (account as Partial<ClassicAccount>).kind === 'classic'
}

// The preferred, documented way to type a wallet whose accounts are a mix of
// known kinds is an *open union* carried by the manager (e.g.
// `WalletManager<MixedAccount>`), mirroring the wallet-provider accounts store
// and its open account type unions. Consumers receive the union through the
// framework hooks via a `Register` declaration; each element then narrows to a
// specific member via a type guard, with no cast at the call site.
type MixedAccount = QuantumAccount | ClassicAccount

describe('Downstream account narrowing', () => {
  const quantum: QuantumAccount = {
    name: 'Quantum Account',
    address: 'q-address',
    kind: 'quantum',
    handleQuantumOperation: () => 'entangled'
  }

  const classic: ClassicAccount = {
    name: 'Classic Account',
    address: 'c-address',
    kind: 'classic',
    legacyId: 7
  }

  it('narrows a heterogeneous accounts array from the default Wallet shape', () => {
    // This is exactly what `const { wallets } = useWallet()` yields: the
    // account type defaults to the open base `WalletAccount`, so a single
    // wallet may hold a mix of subtypes.
    const wallet: Wallet = {
      id: 'mixed',
      walletKey: 'mixed',
      metadata: { name: 'Mixed', icon: '' },
      accounts: [quantum, classic],
      activeAccount: quantum,
      isConnected: true,
      isActive: true,
      canSignData: false,
      canUsePrivateKey: false,
      connect: async () => [],
      disconnect: async () => {},
      setActive: () => {},
      setActiveAccount: () => {}
    }

    // Recast/narrow in the downstream consumer via the type guard.
    const first = wallet.accounts[0]
    if (isQuantumAccount(first)) {
      // `first` is now `QuantumAccount`; subtype members are available.
      expect(first.handleQuantumOperation()).toBe('entangled')
    } else {
      throw new Error('expected the first account to narrow to QuantumAccount')
    }

    // A sibling subtype in the same wallet narrows independently.
    const second = wallet.accounts[1]
    expect(isQuantumAccount(second)).toBe(false)
  })

  it('narrows the mixed accounts held by the base store', () => {
    // The manager owns a single `Store<State>` at the base account type;
    // heterogeneous accounts round-trip and stay narrowable afterwards.
    const store = new Store<State>(DEFAULT_STATE)
    addWallet(store, {
      walletId: 'mixed',
      wallet: { accounts: [quantum, classic], activeAccount: quantum }
    })

    const accounts = store.state.wallets['mixed']?.accounts ?? []
    const quantumAccounts = accounts.filter(isQuantumAccount)

    expect(quantumAccounts).toHaveLength(1)
    expect(quantumAccounts[0].handleQuantumOperation()).toBe('entangled')
  })

  it('narrows within a union account type passed to the generic seat', () => {
    // The preferred pattern: a registered `WalletManager<MixedAccount>` makes
    // the hooks yield `Wallet<MixedAccount>`, so `accounts` is `(QuantumAccount | ClassicAccount)[]`.
    // The type param does NOT collapse the wallet to a single kind; it keeps
    // every member of the union statically visible, ready to narrow per element.
    const wallet: Wallet<MixedAccount> = {
      id: 'mixed',
      walletKey: 'mixed',
      metadata: { name: 'Mixed', icon: '' },
      accounts: [quantum, classic],
      activeAccount: quantum,
      isConnected: true,
      isActive: true,
      canSignData: false,
      canUsePrivateKey: false,
      connect: async () => [],
      disconnect: async () => {},
      setActive: () => {},
      setActiveAccount: () => {}
    }

    // Each element is already `QuantumAccount | ClassicAccount`; a type guard
    // narrows it to the exact member without any cast at the call site.
    for (const account of wallet.accounts) {
      if (isQuantumAccount(account)) {
        expect(account.handleQuantumOperation()).toBe('entangled')
      } else if (isClassicAccount(account)) {
        expect(account.legacyId).toBe(7)
      } else {
        throw new Error('account did not narrow to a known union member')
      }
    }

    // `activeAccount` carries the same union and narrows the same way.
    if (wallet.activeAccount && isQuantumAccount(wallet.activeAccount)) {
      expect(wallet.activeAccount.handleQuantumOperation()).toBe('entangled')
    } else {
      throw new Error('expected the active account to narrow to QuantumAccount')
    }
  })
})

// ---------- Account type inference from construction ---------------- //

// Type-level equality assertion helpers: `Eq<A, B>` resolves to the literal
// type `true` only when A and B are identical, so `const x: Eq<A, B> = true`
// fails to compile if the inference ever regresses.
type Eq<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false

// Adapter configs declaring dedicated account types (as future adapter
// factories will, e.g. `WalletAdapterConfig<PQAccount>`). Declared
// type-only; they are never evaluated at runtime.
declare const quantumConfig: WalletAdapterConfig<QuantumAccount>
declare const classicConfig: WalletAdapterConfig<ClassicAccount>

// Never executed; exists purely to exercise the real inference path of
// `WalletManager.create` with a heterogeneous wallets array.
function typeOnlyCreate() {
  return WalletManager.create({ wallets: [quantumConfig, classicConfig] })
}

describe('Account type inference from construction', () => {
  it('infers the union of adapter account types (type-level)', () => {
    // WalletManager.create([quantum, classic]) => WalletManager<Quantum | Classic>
    const inferredUnion: Eq<
      ReturnType<typeof typeOnlyCreate>,
      WalletManager<QuantumAccount | ClassicAccount>
    > = true

    // InferWalletAccounts unites the account types of a configs tuple
    const tupleUnion: Eq<
      InferWalletAccounts<
        [WalletAdapterConfig<QuantumAccount>, WalletAdapterConfig<ClassicAccount>]
      >,
      QuantumAccount | ClassicAccount
    > = true

    // Configs without a dedicated account type resolve to the base account
    const baseDefault: Eq<InferWalletAccounts<WalletAdapterConfig[]>, WalletAccount> = true

    // An empty wallets array resolves to the base account, not `never`
    const emptyDefault: Eq<InferWalletAccounts<[]>, WalletAccount> = true

    expect(inferredUnion && tupleUnion && baseDefault && emptyDefault).toBe(true)
    expect(typeof typeOnlyCreate).toBe('function')
  })

  it('create() without wallets behaves like the constructor', () => {
    const manager = WalletManager.create()
    expect(manager).toBeInstanceOf(WalletManager)
    expect(manager.store.state.wallets).toEqual({})

    // Bare create() defaults to the base account type
    const baseAccount: Eq<typeof manager, WalletManager<WalletAccount>> = true
    expect(baseAccount).toBe(true)
  })

  it('create() adopts an injected store typed at the inferred account type', () => {
    const store = new Store<State>(DEFAULT_STATE)
    const manager = WalletManager.create({ options: { store } })

    expect(manager.store).toBe(store)
  })
})
