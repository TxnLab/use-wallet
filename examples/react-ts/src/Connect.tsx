import * as ed from '@noble/ed25519'
import {
  ScopeType,
  SignDataError,
  Siwa,
  useWallet,
  type Wallet,
  WalletId
} from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import * as React from 'react'

export function Connect() {
  const { algodClient, activeAddress, signData, transactionSigner, wallets } = useWallet()

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

  const handleConnect = async (wallet: Wallet) => {
    if (isMagicLink(wallet)) {
      await wallet.connect({ email: magicEmail })
    } else {
      await wallet.connect()
    }
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

  const auth = async () => {
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
      const resp = await signData(data, metadata)
      // verify signature
      const enc = new TextEncoder()
      const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
      const authenticatorDataHash = await crypto.subtle.digest(
        'SHA-256',
        new Uint8Array(resp.authenticatorData)
      )
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

  return (
    <div>
      {wallets.map((wallet) => (
        <div key={wallet.id} className="wallet-group">
          <h4>
            {wallet.metadata.name} {wallet.isActive ? '[active]' : ''}
          </h4>

          <div className="wallet-buttons">
            <button
              type="button"
              onClick={() => handleConnect(wallet)}
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
              <div className="wallet-buttons">
                <button type="button" onClick={sendTransaction} disabled={isSending}>
                  {isSending ? 'Sending Transaction...' : 'Send Transaction'}
                </button>
                {wallet.canSignData && (
                  <button type="button" onClick={auth}>
                    Authenticate
                  </button>
                )}
              </div>
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
            <div className="input-group">
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
            <select onChange={(e) => setActiveAccount(e, wallet)}>
              {wallet.accounts.map((account) => (
                <option key={account.address} value={account.address}>
                  {account.address}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  )
}
