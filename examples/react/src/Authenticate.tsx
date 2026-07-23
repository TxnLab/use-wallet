import * as ed from '@noble/ed25519'
import {
  ScopeType,
  SignDataError,
  useNetwork,
  useWallet,
  type Siwa,
  type StdSignData
} from '@txnlab/use-wallet-react'
import { Address } from 'algosdk'
import { canonify } from 'canonify'
import { useState } from 'react'

type AuthStatus = 'idle' | 'signing' | 'verified' | 'error'

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

export function Authenticate() {
  const { activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async () => {
    if (!activeAddress) return

    try {
      setStatus('signing')
      setError(null)

      const domain = location.host
      const acctInfo = await algodClient.accountInformation(activeAddress).do()

      const siwaRequest: Siwa = {
        domain,
        chain_id: activeNetworkConfig.caipChainId || 'algorand',
        account_address: activeAddress,
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
      const signer = acctInfo.authAddr?.publicKey ?? Address.fromString(activeAddress).publicKey
      const stdSignData: StdSignData = {
        data,
        signer,
        domain,
        authenticatorData
      }
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(stdSignData, metadata)
      // verify signature
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(authenticatorData)
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      if (!(await ed.verifyAsync(resp.signature, toSign, signer))) {
        throw new SignDataError('Verification Failed', 4300)
      }
      setStatus('verified')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Authenticate</h3>
      <p className="text-sm text-gray-500 mb-4">Sign data to prove account ownership.</p>

      <button
        onClick={handleAuth}
        disabled={status === 'signing'}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'signing' ? 'Signing...' : 'Authenticate'}
      </button>

      {status === 'verified' && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-sm font-medium text-green-800">Authentication successful</p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-800">Authentication failed</p>
          <p className="mt-1 text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
