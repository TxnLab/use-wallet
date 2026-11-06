import { useWallet, useWalletManager } from '@txnlab/use-wallet-react'
import type { PasskeyAdapter, PasskeyConfirmation } from '@txnlab/use-wallet-passkey'
import { useState } from 'react'
import { updatePasskeySettings, usePasskeySession, usePasskeySettings } from './passkeySession.ts'

const CONFIRMATIONS: { value: PasskeyConfirmation; label: string }[] = [
  { value: 'silent', label: 'Never' },
  { value: 'presence', label: 'With a tap' },
  { value: 'verify', label: 'With biometrics or PIN' }
]

const AUTO_LOCK_OPTIONS: { value: number; label: string }[] = [
  { value: 60 * 1000, label: '1 minute' },
  { value: 5 * 60 * 1000, label: '5 minutes' },
  { value: 15 * 60 * 1000, label: '15 minutes' },
  { value: 60 * 60 * 1000, label: '1 hour' },
  { value: 0, label: 'Never' }
]

const selectClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none'

export function PasskeySession() {
  const { activeWallet } = useWallet()
  const manager = useWalletManager()
  const session = usePasskeySession()
  const settings = usePasskeySettings()
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (activeWallet?.id !== 'passkey') return null

  // Adapter-specific methods aren't on the hook's wallet object
  const getWallet = () => manager.getWallet(activeWallet.walletKey) as PasskeyAdapter | undefined

  const handleUnlock = async () => {
    const wallet = getWallet()
    if (!wallet) return

    setUnlocking(true)
    setError(null)
    try {
      // Runs the passkey prompt straight from the tap: iOS drops it across an await
      await wallet.unlock()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Passkey session</h3>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            session.unlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {session.unlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {session.unlocked
          ? 'Signatures follow your confirmation setting below.'
          : 'The next signature asks for your passkey. Unlock now to skip that prompt.'}
        {session.lastLock && !session.unlocked && (
          <span className="text-gray-400">
            {' '}
            Last lock: <code className="font-mono">{session.lastLock}</code>
          </span>
        )}
      </p>

      <div className="mt-4">
        {session.unlocked ? (
          <button
            onClick={() => getWallet()?.lock()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Lock now
          </button>
        ) : (
          <button
            data-passkey-unlock
            onClick={handleUnlock}
            disabled={unlocking}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {unlocking ? 'Waiting for passkey...' : 'Unlock'}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Confirm signatures
          </span>
          <select
            value={settings.confirmation}
            onChange={(event) =>
              updatePasskeySettings({ confirmation: event.target.value as PasskeyConfirmation })
            }
            className={selectClass}
          >
            {CONFIRMATIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Lock after unlocking
          </span>
          <select
            value={settings.autoLockMs}
            onChange={(event) => updatePasskeySettings({ autoLockMs: Number(event.target.value) })}
            className={selectClass}
          >
            {AUTO_LOCK_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={settings.lockWhenHidden}
          onChange={(event) => updatePasskeySettings({ lockWhenHidden: event.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
        Lock when I leave this tab
      </label>
      <p className="mt-3 text-xs text-gray-400">
        These settings decide how often signing asks for your passkey. They're saved in this
        browser, and anyone who controls this site could change them.
      </p>
    </div>
  )
}
