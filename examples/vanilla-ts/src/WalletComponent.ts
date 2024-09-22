import { BaseWallet, WalletId, WalletManager } from 'avm-wallet'
import algosdk from 'algosdk'

export class WalletComponent {
  wallet: BaseWallet
  manager: WalletManager
  element: HTMLElement
  private unsubscribe?: () => void
  private magicEmail: string = ''

  constructor(wallet: BaseWallet, manager: WalletManager) {
    this.wallet = wallet
    this.manager = manager
    this.element = document.createElement('div')

    this.unsubscribe = wallet.subscribe((state) => {
      console.info('[App] State change:', state)
      this.render()
    })

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
        from: activeAddress,
        to: activeAddress,
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

  setActiveAccount = (event: Event) => {
    const target = event.target as HTMLSelectElement
    this.wallet.setActiveAccount(target.value)
  }

  isMagicLink = () => this.wallet.id === WalletId.MAGIC
  isEmailValid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.magicEmail)
  isConnectDisabled = () => this.wallet.isConnected || (this.isMagicLink() && !this.isEmailValid())
  getConnectArgs = () => (this.isMagicLink() ? { email: this.magicEmail } : undefined)

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
              ? `<button id="transaction-button" type="button">Send Transaction</button>`
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
        const args = this.getConnectArgs()
        this.connect(args)
      } else if (target.id === 'disconnect-button') {
        this.disconnect()
      } else if (target.id === 'set-active-button') {
        this.setActive()
      } else if (target.id === 'transaction-button') {
        this.sendTransaction()
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
    this.element.removeEventListener('click', this.addEventListeners)
    this.element.removeEventListener('change', this.addEventListeners)
    this.element.removeEventListener('input', this.addEventListeners)
  }
}
