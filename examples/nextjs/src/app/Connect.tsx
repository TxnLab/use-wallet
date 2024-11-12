'use client'

import { NetworkId, WalletId, useWallet, type Wallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import * as React from 'react'
import styles from './Connect.module.css'

export function Connect() {
  const {
    algodClient,
    activeAddress,
    activeNetwork,
    setActiveNetwork,
    transactionSigner,
    wallets
  } = useWallet()

  const [isSending, setIsSending] = React.useState(false)
  const [magicEmail, setMagicEmail] = React.useState('')

  const isMagicLink = (wallet: Wallet) => wallet.id === WalletId.MAGIC
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(magicEmail)

  const isConnectDisabled = (wallet: Wallet) => {
    if (wallet.isConnected) {
      return true
    }
    if (isMagicLink(wallet) && !isEmailValid) {
      return true
    }
    return false
  }

  const getConnectArgs = (wallet: Wallet) => {
    if (isMagicLink(wallet)) {
      return { email: magicEmail }
    }
    return undefined
  }

  const setActiveAccount = (event: React.ChangeEvent<HTMLSelectElement>, wallet: Wallet) => {
    const target = event.target
    wallet.setActiveAccount(target.value)
  }

  const sendTransaction = async () => {
    try {
      if (!activeAddress) {
        throw new Error('[App] No active account')
      }

      const atc = new algosdk.AtomicTransactionComposer()
      const suggestedParams = await algodClient.getTransactionParams().do()

      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: activeAddress,
        amount: 0,
        suggestedParams
      })

      atc.addTransaction({ txn: transaction, signer: transactionSigner })

      console.info(`[App] Sending transaction...`, transaction)

      setIsSending(true)

      const result = await atc.execute(algodClient, 4)

      console.info(`[App] ✅ Successfully sent transaction!`, {
        confirmedRound: result.confirmedRound,
        txIDs: result.txIDs
      })
    } catch (error) {
      console.error('[App] Error signing transaction:', error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div>
      <div className={styles.networkGroup}>
        <h4>
          Current Network: <span className={styles.activeNetwork}>{activeNetwork}</span>
        </h4>
        <div className={styles.networkButtons}>
          <button
            type="button"
            onClick={() => setActiveNetwork(NetworkId.BETANET)}
            disabled={activeNetwork === NetworkId.BETANET}
          >
            Set to Betanet
          </button>
          <button
            type="button"
            onClick={() => setActiveNetwork(NetworkId.TESTNET)}
            disabled={activeNetwork === NetworkId.TESTNET}
          >
            Set to Testnet
          </button>
          <button
            type="button"
            onClick={() => setActiveNetwork(NetworkId.MAINNET)}
            disabled={activeNetwork === NetworkId.MAINNET}
          >
            Set to Mainnet
          </button>
        </div>
      </div>

      {wallets.map((wallet) => (
        <div key={wallet.id} className={styles.walletGroup}>
          <h4 className={styles.walletName} data-active={wallet.isActive}>
            {wallet.metadata.name}
          </h4>
          <div className={styles.walletButtons}>
            <button
              type="button"
              onClick={() => wallet.connect(getConnectArgs(wallet))}
              disabled={isConnectDisabled(wallet)}
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => wallet.disconnect()}
              disabled={!wallet.isConnected}
            >
              Disconnect
            </button>
            {wallet.isActive ? (
              <button type="button" onClick={sendTransaction} disabled={isSending}>
                {isSending ? 'Sending Transaction...' : 'Send Transaction'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => wallet.setActive()}
                disabled={!wallet.isConnected}
              >
                Set Active
              </button>
            )}
          </div>

          {isMagicLink(wallet) && (
            <div className={styles.inputGroup}>
              <label htmlFor="magic-email">Email:</label>
              <input
                id="magic-email"
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder="Enter email to connect..."
                disabled={wallet.isConnected}
              />
            </div>
          )}

          {wallet.isActive && wallet.accounts.length > 0 && (
            <div>
              <select onChange={(e) => setActiveAccount(e, wallet)}>
                {wallet.accounts.map((account) => (
                  <option key={account.address} value={account.address}>
                    {account.address}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
