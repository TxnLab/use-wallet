import { BaseWallet, WalletManager } from '@txnlab/use-wallet-js'
import algosdk from 'algosdk'

export class WalletComponent {
  wallet: BaseWallet
  manager: WalletManager
  element: HTMLElement
  private unsubscribe?: () => void

  constructor(wallet: BaseWallet, manager: WalletManager) {
    this.wallet = wallet
    this.manager = manager
    this.element = document.createElement('div')

    this.unsubscribe = wallet.subscribe((state) => {
      console.log('State change:', state)
      this.render()
    })

    this.render()
    this.addEventListeners()
  }

  connect = () => this.wallet.connect()
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

  render() {
    this.element.innerHTML = `
      <h4>
        ${this.wallet.metadata.name} ${this.wallet.isActive ? '[active]' : ''}
      </h4>
      <div class="wallet-buttons">
        <button id="connect-button" type="button" ${this.wallet.isConnected ? 'disabled' : ''}>
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
    `
  }

  addEventListeners() {
    this.element.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement
      if (target.id === 'connect-button') {
        this.connect()
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
  }

  destroy() {
    // Disconnect the listener on unmount to prevent memory leaks
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    this.element.removeEventListener('click', this.addEventListeners)
    this.element.removeEventListener('change', this.addEventListeners)
  }
}
