import * as ed from '@noble/ed25519'
import {
  BaseWallet,
  ScopeType,
  SignDataError,
  Siwa,
  WalletId,
  WalletManager
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import {
  isFirebaseConfigured,
  firebaseSignOut,
  getFreshIdToken,
  onFirebaseAuthStateChanged,
  type User
} from './firebase'
import { FirebaseAuthComponent } from './FirebaseAuthComponent'

export class WalletComponent {
  wallet: BaseWallet
  manager: WalletManager
  element: HTMLElement
  private unsubscribe?: () => void
  private unsubscribeFirebase?: () => void
  private magicEmail: string = ''
  private firebaseUser: User | null = null
  private firebaseAuthComponent: FirebaseAuthComponent | null = null

  constructor(wallet: BaseWallet, manager: WalletManager) {
    this.wallet = wallet
    this.manager = manager
    this.element = document.createElement('div')

    this.unsubscribe = wallet.subscribe((state) => {
      console.info('[App] State change:', state)
      this.render()
    })

    // Subscribe to Firebase auth state for Web3Auth wallets
    if (this.isWeb3Auth()) {
      this.unsubscribeFirebase = onFirebaseAuthStateChanged((user) => {
        this.firebaseUser = user
        this.render()
      })
    }

    this.render()
    this.addEventListeners()
  }

  connect = (args?: Record<string, any>) => this.wallet.connect(args)
  disconnect = () => this.wallet.disconnect()
  setActive = () => this.wallet.setActive()

  sendTransaction = async () => {
    const txnButton = this.element.querySelector('#transaction-button') as HTMLButtonElement
    if (!txnButton) return

    try {
      const activeAddress = this.wallet.activeAccount?.address

      if (!activeAddress) {
        throw new Error('[App] No active account')
      }

      const atc = new algosdk.AtomicTransactionComposer()
      const suggestedParams = await this.manager.algodClient.getTransactionParams().do()

      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: activeAddress,
        amount: 0,
        suggestedParams
      })

      atc.addTransaction({ txn: transaction, signer: this.wallet.transactionSigner })

      console.info(`[App] Sending transaction...`, transaction)

      txnButton.disabled = true
      txnButton.textContent = 'Sending Transaction...'

      const result = await atc.execute(this.manager.algodClient, 4)

      console.info(`[App] ✅ Successfully sent transaction!`, {
        confirmedRound: result.confirmedRound,
        txIDs: result.txIDs
      })
    } catch (error) {
      console.error('[App] Error signing transaction:', error)
    } finally {
      txnButton.disabled = false
      txnButton.textContent = 'Send Transaction'
    }
  }

  auth = async () => {
    const activeAddress = this.wallet.activeAccount?.address
    if (!activeAddress) {
      throw new Error('[App] No active account')
    }
    try {
      const siwaRequest: Siwa = {
        domain: location.host,
        chain_id: '283',
        account_address: activeAddress,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await this.wallet.signData(data, metadata)
      // verify signature
      const enc = new TextEncoder()
      const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
      const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)
      const toSign = new Uint8Array(64)
      toSign.set(new Uint8Array(clientDataJsonHash), 0)
      toSign.set(new Uint8Array(authenticatorDataHash), 32)
      const pubKey = algosdk.Address.fromString(activeAddress).publicKey
      if (!(await ed.verifyAsync(resp.signature, toSign, pubKey))) {
        throw new SignDataError('Verification Failed', 4300)
      }
      console.info(`[App] ✅ Successfully authenticated!`)
    } catch (error) {
      console.error('[App] Error signing data:', error)
    }
  }

  setActiveAccount = (event: Event) => {
    const target = event.target as HTMLSelectElement
    this.wallet.setActiveAccount(target.value)
  }

  isMagicLink = () => this.wallet.id === WalletId.MAGIC
  isWeb3Auth = () => this.wallet.id === WalletId.WEB3AUTH
  isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.magicEmail)

  isConnectDisabled = () => {
    if (this.wallet.isConnected) {
      return true
    }
    if (this.isMagicLink() && !this.isEmailValid()) {
      return true
    }
    return false
  }

  // Firebase SFA connection
  handleFirebaseConnect = async () => {
    if (!this.firebaseUser) {
      console.error('[App] No Firebase user signed in')
      return
    }

    const idToken = await getFreshIdToken()
    if (!idToken) {
      console.error('[App] Failed to get Firebase ID token')
      return
    }

    const verifierId = this.firebaseUser.uid
    console.info('[App] Connecting Web3Auth with Firebase auth...', { verifierId })

    await this.wallet.connect({ idToken, verifierId })
  }

  handleConnect = async () => {
    if (this.isMagicLink()) {
      await this.wallet.connect({ email: this.magicEmail })
    } else {
      await this.wallet.connect()
    }
  }

  handleFirebaseSignOut = async () => {
    try {
      await firebaseSignOut()
      console.info('[App] Signed out from Firebase')
    } catch (error) {
      console.error('[App] Firebase sign-out error:', error)
    }
  }

  render() {
    this.element.innerHTML = `
      <div class="wallet-group">
        <h4>
          ${this.wallet.metadata.name} ${this.wallet.isActive ? '[active]' : ''}
        </h4>

        <div class="wallet-buttons">
          <button id="connect-button" type="button" ${this.isConnectDisabled() ? 'disabled' : ''}>
            Connect
          </button>
          <button id="disconnect-button" type="button" ${!this.wallet.isConnected ? 'disabled' : ''}>
            Disconnect
          </button>
          ${
            this.wallet.isActive
              ? `<button id="transaction-button" type="button">Send Transaction</button>
              ${
                this.wallet.canSignData
                  ? `<button id="auth-button" type="button">Authenticate</button>`
                  : ''
              }`
              : `<button id="set-active-button" type="button" ${
                  !this.wallet.isConnected ? 'disabled' : ''
                }>Set Active</button>`
          }
        </div>

        ${
          this.isMagicLink()
            ? `
        <div class="input-group">
          <label for="magic-email">Email:</label>
          <input
            id="magic-email"
            type="email"
            value="${this.magicEmail}"
            placeholder="Enter email to connect..."
            ${this.wallet.isConnected ? 'disabled' : ''}
          />
        </div>
      `
            : ''
        }

        ${
          this.isWeb3Auth() && isFirebaseConfigured && !this.wallet.isConnected
            ? `
        <!-- Firebase SFA Authentication -->
        <div class="firebase-sfa-section">
          <div class="section-divider">
            <span>or connect with Firebase</span>
          </div>
          ${
            this.firebaseUser
              ? `
            <div class="firebase-user">
              <span>Signed in as: ${this.firebaseUser.email || this.firebaseUser.uid}</span>
              <div class="firebase-user-buttons">
                <button type="button" id="firebase-signout">Sign Out</button>
                <button type="button" id="firebase-connect">Connect with Firebase</button>
              </div>
            </div>
          `
              : `
            <div class="firebase-auth" id="firebase-auth-container">
            </div>
          `
          }
        </div>
        <!-- End Firebase SFA Authentication -->
      `
            : ''
        }

        ${
          this.wallet.isActive && this.wallet.accounts.length
            ? `
          <div>
            <select>
              ${this.wallet.accounts
                .map(
                  (account) => `
                <option value="${account.address}" ${
                  account.address === this.wallet.activeAccount?.address ? 'selected' : ''
                }>
                  ${account.address}
                </option>
              `
                )
                .join('')}
            </select>
          </div>
        `
            : ''
        }
      </div>
    `

    // Append Firebase auth component if needed
    if (this.isWeb3Auth() && isFirebaseConfigured && !this.wallet.isConnected && !this.firebaseUser) {
      const container = this.element.querySelector('#firebase-auth-container')
      if (container) {
        // Recreate the Firebase auth component
        if (this.firebaseAuthComponent) {
          this.firebaseAuthComponent.destroy()
        }
        this.firebaseAuthComponent = new FirebaseAuthComponent({
          onSignInSuccess: () => console.info('[App] Firebase sign-in successful')
        })
        container.appendChild(this.firebaseAuthComponent.element)
      }
    }
  }

  updateEmailInput = () => {
    const emailInput = this.element.querySelector('#magic-email') as HTMLInputElement
    if (emailInput) {
      emailInput.value = this.magicEmail
    }

    const connectButton = this.element.querySelector('#connect-button') as HTMLButtonElement
    if (connectButton) {
      connectButton.disabled = this.isConnectDisabled()
    }
  }

  addEventListeners() {
    this.element.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement
      if (target.id === 'connect-button') {
        this.handleConnect()
      } else if (target.id === 'disconnect-button') {
        this.disconnect()
      } else if (target.id === 'set-active-button') {
        this.setActive()
      } else if (target.id === 'transaction-button') {
        this.sendTransaction()
      } else if (target.id === 'auth-button') {
        this.auth()
      } else if (target.id === 'firebase-signout') {
        this.handleFirebaseSignOut()
      } else if (target.id === 'firebase-connect') {
        this.handleFirebaseConnect()
      }
    })

    // Select a new active account
    this.element.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLElement
      if (target.tagName.toLowerCase() === 'select') {
        this.setActiveAccount(e)
      }
    })

    // Update email input on each keystroke
    this.element.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.id === 'magic-email') {
        this.magicEmail = target.value
        this.updateEmailInput()
      }
    })
  }

  destroy() {
    // Disconnect the listener on unmount to prevent memory leaks
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    if (this.unsubscribeFirebase) {
      this.unsubscribeFirebase()
    }
    if (this.firebaseAuthComponent) {
      this.firebaseAuthComponent.destroy()
    }
    this.element.removeEventListener('click', this.addEventListeners)
    this.element.removeEventListener('change', this.addEventListeners)
    this.element.removeEventListener('input', this.addEventListeners)
  }
}
