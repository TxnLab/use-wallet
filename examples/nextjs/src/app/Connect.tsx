'use client'

import { useWallet, type Wallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import * as React from 'react'
import styles from './Connect.module.css'

export function Connect() {
  const [isSending, setIsSending] = React.useState(false)

  const { algodClient, activeAddress, transactionSigner, wallets } = useWallet()

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
        from: activeAddress,
        to: activeAddress,
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
      {wallets.map((wallet) => (
        <div key={wallet.id}>
          <h4 className={styles.walletName} data-active={wallet.isActive}>
            {wallet.metadata.name}
          </h4>
          <div className={styles.walletButtons}>
            <button type="button" onClick={() => wallet.connect()} disabled={wallet.isConnected}>
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
