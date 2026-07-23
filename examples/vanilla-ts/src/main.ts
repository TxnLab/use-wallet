import * as ed from '@noble/ed25519'
import {
  ScopeType,
  SignDataError,
  WalletManager,
  type BaseWallet,
  type Siwa,
  type StdSignData
} from '@txnlab/use-wallet'
import { defly } from '@txnlab/use-wallet-defly'
import { deflyWeb } from '@txnlab/use-wallet-defly-web'
import { exodus } from '@txnlab/use-wallet-exodus'
import { kibisis } from '@txnlab/use-wallet-kibisis'
import { kmd } from '@txnlab/use-wallet-kmd'
import { lute } from '@txnlab/use-wallet-lute'
import { magic } from '@txnlab/use-wallet-magic'
import { mnemonic } from '@txnlab/use-wallet-mnemonic'
import { pera } from '@txnlab/use-wallet-pera'
import { w3wallet } from '@txnlab/use-wallet-w3wallet'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'
import { web3auth } from '@txnlab/use-wallet-web3auth'
import algosdk, { Address } from 'algosdk'
import { canonify } from 'canonify'
import './style.css'

const WC_PROJECT_ID = 'fcfde0713d43baa0d23be0773c80a72b'
const MAGIC_ID = 'magic'

const wallets = [
  pera(),
  lute(),
  defly(),
  deflyWeb(),
  exodus(),
  walletConnect({ projectId: WC_PROJECT_ID }),
  walletConnect({ projectId: WC_PROJECT_ID, skin: 'biatec' }),
  kibisis(),
  w3wallet(),
  kmd(),
  mnemonic(),
  magic({ apiKey: 'pk_live_D17FD8D89621B5F3' }),
  ...(import.meta.env.VITE_WEB3AUTH_CLIENT_ID
    ? [web3auth({ clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID })]
    : [])
]

const manager = new WalletManager({
  wallets,
  defaultNetwork: 'testnet'
})

let connectingId: string | null = null
let magicEmail = ''
let txnStatus: 'idle' | 'signing' | 'confirming' | 'confirmed' | 'error' = 'idle'
let authStatus: 'idle' | 'signing' | 'verified' | 'error' = 'idle'
let txId: string | null = null
let txnError: string | null = null
let authError: string | null = null

function getState() {
  return manager.store.state
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderNetworkSwitch() {
  const state = getState()
  const networkConfig = manager.networkConfig
  return `
    <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      ${Object.keys(networkConfig)
        .map(
          (id) => `
        <button data-network="${id}" class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          id === state.activeNetwork
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }">${id}</button>`
        )
        .join('')}
    </div>`
}

function renderWalletList() {
  const state = getState()
  const walletHtml = [...manager.availableWallets]
    .map((wallet) => {
      const walletState = state.wallets[wallet.walletKey]
      const isConnected = !!walletState
      const isActive = wallet.walletKey === state.activeWallet
      const activeAccount = walletState?.activeAccount

      let buttons = ''
      if (isConnected) {
        if (!isActive) {
          buttons += `<button data-activate="${wallet.walletKey}" class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors">Activate</button>`
        }
        buttons += `<button data-disconnect="${wallet.walletKey}" class="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-100 transition-colors">Disconnect</button>`
      } else {
        const isDisabled =
          connectingId === wallet.id ||
          (wallet.id === MAGIC_ID && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail))
        buttons += `<button data-connect="${wallet.walletKey}" ${isDisabled ? 'disabled' : ''} class="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">${connectingId === wallet.id ? 'Connecting...' : 'Connect'}</button>`
      }

      let addressHtml = ''
      if (isConnected && activeAccount) {
        addressHtml = `<div class="text-xs text-gray-400 truncate font-mono">${activeAccount.address.slice(0, 8)}...${activeAccount.address.slice(-4)}</div>`
      }

      let magicInput = ''
      if (wallet.id === MAGIC_ID && !isConnected) {
        magicInput = `<input type="email" data-magic-email placeholder="Email address" value="${escapeHtml(magicEmail)}" class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />`
      }

      return `
        <div class="rounded-xl border p-3 transition-colors ${isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}">
          <div class="flex items-center gap-3">
            <img src="${wallet.metadata.icon}" alt="${escapeHtml(wallet.metadata.name)}" class="h-10 w-10 rounded-lg shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900">${escapeHtml(wallet.metadata.name)}</div>
              ${addressHtml}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">${buttons}</div>
          </div>
          ${magicInput}
        </div>`
    })
    .join('')

  return `
    <div class="space-y-2">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Wallets</h2>
      ${walletHtml}
    </div>`
}

function renderActiveWallet() {
  const state = getState()
  if (!state.activeWallet) {
    return `
      <div class="flex items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12">
        <p class="text-sm text-gray-400">Connect a wallet to get started</p>
      </div>`
  }

  const wallet = manager.getWallet(state.activeWallet)
  if (!wallet) return ''

  const walletState = state.wallets[wallet.walletKey]
  const activeAccount = walletState?.activeAccount
  if (!activeAccount) return ''

  let accountSwitcher = ''
  if (walletState && walletState.accounts.length > 1) {
    const options = walletState.accounts
      .map(
        (a) =>
          `<option value="${a.address}" ${a.address === activeAccount.address ? 'selected' : ''}>${a.address.slice(0, 12)}...${a.address.slice(-8)}</option>`
      )
      .join('')
    accountSwitcher = `
      <div>
        <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Switch Account</label>
        <select data-account-switch class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">${options}</select>
      </div>`
  }

  let txnStatusHtml = ''
  if (txnStatus === 'confirmed' && txId) {
    txnStatusHtml = `
      <div class="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
        <p class="text-sm font-medium text-green-800">Transaction confirmed</p>
        <p class="mt-1 text-xs text-green-600 font-mono break-all">${txId}</p>
      </div>`
  } else if (txnStatus === 'error' && txnError) {
    txnStatusHtml = `
      <div class="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
        <p class="text-sm font-medium text-red-800">Transaction failed</p>
        <p class="mt-1 text-xs text-red-600">${escapeHtml(txnError)}</p>
      </div>`
  }

  let authStatusHtml = ''
  if (authStatus === 'verified') {
    authStatusHtml = `
      <div class="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
        <p class="text-sm font-medium text-green-800">Authentication successful</p>
      </div>`
  } else if (authStatus === 'error' && authError) {
    authStatusHtml = `
      <div class="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
        <p class="text-sm font-medium text-red-800">Authentication failed</p>
        <p class="mt-1 text-xs text-red-600">${escapeHtml(authError)}</p>
      </div>`
  }

  const authBtnLabel = authStatus === 'signing' ? 'Signing...' : 'Authenticate'
  const authBtnDisabled = authStatus === 'signing'

  let authHtml = ''
  if (getWalletByKey(state.activeWallet)?.canSignData) {
    authHtml = `
      <div class="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Authenticate</h3>
        <p class="text-sm text-gray-500 mb-4">Sign data to prove account ownership.</p>
        <button data-auth ${authBtnDisabled ? 'disabled' : ''} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">${authBtnLabel}</button>
        ${authStatusHtml}
      </div>`
  }

  const txnBtnLabel =
    txnStatus === 'signing'
      ? 'Signing...'
      : txnStatus === 'confirming'
        ? 'Confirming...'
        : 'Send 0 ALGO'
  const txnBtnDisabled = txnStatus === 'signing' || txnStatus === 'confirming'

  return `
    <div class="space-y-6">
      <div class="rounded-2xl border border-gray-200 bg-white p-6">
        <div class="flex items-center gap-4 mb-6">
          <img src="${wallet.metadata.icon}" alt="${escapeHtml(wallet.metadata.name)}" class="h-12 w-12 rounded-xl" />
          <div>
            <h2 class="text-lg font-semibold text-gray-900">${escapeHtml(wallet.metadata.name)}</h2>
            <div class="flex items-center gap-1.5">
              <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Connected</span>
              <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Active</span>
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Account</label>
            <div class="mt-1 rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700 break-all">${activeAccount.address}</div>
          </div>
          ${accountSwitcher}
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Send Transaction</h3>
        <p class="text-sm text-gray-500 mb-4">Send a 0 ALGO payment to yourself as a test transaction.</p>
        <button data-send-txn ${txnBtnDisabled ? 'disabled' : ''} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">${txnBtnLabel}</button>
        ${txnStatusHtml}
      </div>

        ${authHtml}
    </div>`
}

function render() {
  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      <header class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <h1 class="text-lg font-semibold tracking-tight text-gray-900">
            use-wallet<span class="text-gray-400 font-normal"> / vanilla-ts</span>
          </h1>
          ${renderNetworkSwitch()}
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-6 py-8">
        <div class="grid gap-8 lg:grid-cols-[320px_1fr]">
          ${renderWalletList()}
          ${renderActiveWallet()}
        </div>
      </main>
    </div>`

  attachEventListeners()
}

function getWalletByKey(walletKey: string): BaseWallet | undefined {
  return [...manager.wallets].find((w) => w.walletKey === walletKey)
}

function attachEventListeners() {
  // Network switch
  document.querySelectorAll<HTMLButtonElement>('[data-network]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const networkId = btn.dataset.network!
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
      await manager.setActiveNetwork(networkId)
      manager.store.setState((state) => ({
        ...state,
        activeNetwork: networkId,
        algodClient: newClient
      }))
    })
  })

  // Connect
  document.querySelectorAll<HTMLButtonElement>('[data-connect]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const wallet = getWalletByKey(btn.dataset.connect!)
      if (!wallet) return
      try {
        connectingId = wallet.id
        render()
        if (wallet.id === MAGIC_ID) {
          await wallet.connect({ email: magicEmail })
        } else {
          await wallet.connect()
        }
      } catch (error) {
        console.error(`Failed to connect ${wallet.metadata.name}:`, error)
      } finally {
        connectingId = null
        render()
      }
    })
  })

  // Activate
  document.querySelectorAll<HTMLButtonElement>('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wallet = getWalletByKey(btn.dataset.activate!)
      wallet?.setActive()
    })
  })

  // Disconnect
  document.querySelectorAll<HTMLButtonElement>('[data-disconnect]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const wallet = getWalletByKey(btn.dataset.disconnect!)
      await wallet?.disconnect()
    })
  })

  // Magic email
  const emailInput = document.querySelector<HTMLInputElement>('[data-magic-email]')
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      magicEmail = emailInput.value
      render()
    })
  }

  // Account switcher
  const accountSelect = document.querySelector<HTMLSelectElement>('[data-account-switch]')
  if (accountSelect) {
    accountSelect.addEventListener('change', () => {
      const state = getState()
      if (!state.activeWallet) return
      const wallet = getWalletByKey(state.activeWallet)
      wallet?.setActiveAccount(accountSelect.value)
    })
  }

  // Send transaction
  const sendBtn = document.querySelector<HTMLButtonElement>('[data-send-txn]')
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendTransaction)
  }

  // Authenticate
  const authBtn = document.querySelector<HTMLButtonElement>('[data-auth]')
  if (authBtn) {
    authBtn.addEventListener('click', handleAuth)
  }
}

async function handleSendTransaction() {
  const state = getState()
  if (!state.activeWallet) return

  const wallet = getWalletByKey(state.activeWallet)
  if (!wallet) return

  const activeAccount = state.wallets[wallet.walletKey]?.activeAccount
  if (!activeAccount) return

  try {
    txnStatus = 'signing'
    txId = null
    txnError = null
    render()

    const suggestedParams = await state.algodClient.getTransactionParams().do()

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAccount.address,
      receiver: activeAccount.address,
      amount: 0,
      suggestedParams
    })

    const atc = new algosdk.AtomicTransactionComposer()
    atc.addTransaction({
      txn,
      signer: (txnGroup: algosdk.Transaction[], indexesToSign: number[]) =>
        wallet.transactionSigner(txnGroup, indexesToSign)
    })
    await atc.gatherSignatures()

    txnStatus = 'confirming'
    render()
    const result = await atc.execute(state.algodClient, 4)

    txId = result.txIDs[0] ?? null
    txnStatus = 'confirmed'
  } catch (err) {
    txnError = err instanceof Error ? err.message : 'Transaction failed'
    txnStatus = 'error'
  }
  render()
}

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

async function handleAuth() {
  const state = getState()
  if (!state.activeWallet) return

  const wallet = getWalletByKey(state.activeWallet)
  if (!wallet) return

  const activeAccount = state.wallets[wallet.walletKey]?.activeAccount
  if (!activeAccount) return

  const activeNetworkConfig = state.networkConfig[state.activeNetwork]
  if (!activeNetworkConfig) return

  const algodClient = state.algodClient
  if (!algodClient) return

  try {
    authStatus = 'signing'
    render()
    const domain = location.host
    const acctInfo = await algodClient.accountInformation(activeAccount.address).do()

    const siwaRequest: Siwa = {
      domain,
      chain_id: activeNetworkConfig.caipChainId || 'algorand',
      account_address: activeAccount.address,
      type: 'ed25519',
      uri: location.origin,
      version: '1',
      'issued-at': new Date().toISOString()
    }
    const dataString = canonify(siwaRequest)
    if (!dataString) throw Error('Invalid JSON')
    const data = btoa(dataString)
    const enc = new TextEncoder()
    const authenticatorData = await sha256(enc.encode(domain))
    const signer =
      acctInfo.authAddr?.publicKey ?? Address.fromString(activeAccount.address).publicKey
    const stdSignData: StdSignData = {
      data,
      signer,
      domain,
      authenticatorData
    }
    const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
    const resp = await wallet.signData(stdSignData, metadata)
    // verify signature
    const clientDataJsonHash = await sha256(enc.encode(dataString))
    const authenticatorDataHash = await sha256(authenticatorData)
    const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
    if (!(await ed.verifyAsync(resp.signature, toSign, signer))) {
      throw new SignDataError('Verification Failed', 4300)
    }

    authStatus = 'verified'
  } catch (err) {
    authError = err instanceof Error ? err.message : 'Verification failed'
    authStatus = 'error'
  }
  render()
}

// Initial render
render()

// Subscribe to store changes
manager.store.subscribe(() => {
  render()
})

// Resume sessions
manager.resumeSessions().catch((error) => {
  console.error('Error resuming sessions:', error)
})
