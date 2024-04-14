import { render, screen } from '@solidjs/testing-library'
import { WalletId, WalletManager } from '@txnlab/use-wallet'
import { WalletProvider, useWalletManager } from '../WalletProvider'

describe('WalletProvider', () => {
  it('provides the WalletManager to its children', () => {
    const TestComponent = () => {
      const manager = useWalletManager()
      return <h1>{manager ? 'Manager provided' : 'No manager'}</h1>
    }

    const walletManager = new WalletManager({
      wallets: [WalletId.DEFLY]
    })

    render(() => (
      <WalletProvider manager={walletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByText('Manager provided')).toBeInTheDocument()
  })

  it('throws an error when useWalletManager is used outside of WalletProvider', () => {
    const TestComponent = () => {
      try {
        useWalletManager()
        return <div>No error thrown</div>
      } catch (error: any) {
        return <div>{error.message}</div>
      }
    }

    render(() => <TestComponent />)
    expect(
      screen.getByText('useWalletManager must be used within a WalletProvider')
    ).toBeInTheDocument()
  })

  it('calls resumeSessions on mount', async () => {
    const mockResumeSessions = vi.fn()
    const fakeManager = { resumeSessions: mockResumeSessions }

    render(() => (
      <WalletProvider manager={fakeManager as any as WalletManager}>
        <div />
      </WalletProvider>
    ))

    expect(mockResumeSessions).toHaveBeenCalled()
  })
})
