import { NetworkId, WalletManager } from '@txnlab/use-wallet'

export class ActiveNetwork {
  manager: WalletManager
  element: HTMLElement

  constructor(manager: WalletManager) {
    this.manager = manager
    this.element = document.createElement('div')
    this.element.className = 'network-group'
    this.render()
    this.addEventListeners()
  }

  setActiveNetwork = (network: NetworkId) => {
    this.manager.setActiveNetwork(network)
    this.render()
  }

  render() {
    const activeNetwork = this.manager.activeNetwork

    this.element.innerHTML = `
      <h4>
        Current Network: <span class="active-network">${activeNetwork}</span>
      </h4>
      <div class="network-buttons">
        <button type="button" id="set-betanet" ${activeNetwork === NetworkId.BETANET ? 'disabled' : ''}>
          Set to Betanet
        </button>
        <button type="button" id="set-testnet" ${activeNetwork === NetworkId.TESTNET ? 'disabled' : ''}>
          Set to Testnet
        </button>
        <button type="button" id="set-mainnet" ${activeNetwork === NetworkId.MAINNET ? 'disabled' : ''}>
          Set to Mainnet
        </button>
      </div>
    `
  }

  addEventListeners() {
    this.element.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLButtonElement
      if (target.id === 'set-betanet') {
        this.setActiveNetwork(NetworkId.BETANET)
      } else if (target.id === 'set-testnet') {
        this.setActiveNetwork(NetworkId.TESTNET)
      } else if (target.id === 'set-mainnet') {
        this.setActiveNetwork(NetworkId.MAINNET)
      }
    })
  }

  destroy() {
    this.element.removeEventListener('click', this.addEventListeners)
  }
}
