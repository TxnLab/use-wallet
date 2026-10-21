import { useWallet, useWalletManager } from '@txnlab/use-wallet-react'
import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'
import { useEffect, useState } from 'react'

const HIDE_AFTER_MS = 60_000

export function RecoveryPhrase() {
  const { activeWallet } = useWallet()
  const manager = useWalletManager()
  // Keyed by wallet, so the phrase is never shown for another wallet
  const [revealed, setRevealed] = useState<{ walletKey: string; words: string[] } | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hide the phrase again after a minute
  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(null), HIDE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  if (activeWallet?.id !== 'passkey') return null
  const words = revealed?.walletKey === activeWallet.walletKey ? revealed.words : null

  const handleReveal = async () => {
    // Adapter-specific methods aren't on the hook's wallet object
    const wallet = manager.getWallet(activeWallet.walletKey) as PasskeyAdapter | undefined
    if (!wallet) return

    setRevealing(true)
    setError(null)
    try {
      // Starts a passkey prompt with full user verification
      const { phrase } = await wallet.exportRecoveryPhrase()
      setRevealed({ walletKey: activeWallet.walletKey, words: phrase.split(' ') })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">Recovery phrase</h3>
      <p className="mt-1 text-sm text-gray-500">
        This account is tied to your passkey and this site. Its 25-word phrase restores it in
        another wallet.
      </p>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Import it as a <strong>Falcon / quantum account</strong>: in Lute, Add account → Falcon25
        account → Import; in Pera, the quantum import. A regular 25-word import restores a
        different, empty account.
      </div>

      {words ? (
        <>
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {words.map((word, index) => (
              <li
                key={index}
                className="rounded-md bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700"
              >
                <span className="mr-1 text-gray-400">{index + 1}.</span>
                {word}
              </li>
            ))}
          </ol>
          <button
            onClick={() => setRevealed(null)}
            className="mt-4 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Hide
          </button>
        </>
      ) : (
        <button
          onClick={handleReveal}
          disabled={revealing}
          className="mt-4 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {revealing ? 'Waiting for passkey...' : 'Reveal recovery phrase'}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
