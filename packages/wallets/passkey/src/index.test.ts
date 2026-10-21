import { passkey, PasskeyAdapter, WALLET_ID } from './index'

describe('passkey()', () => {
  it('returns the adapter config', () => {
    const config = passkey()
    expect(config.id).toBe(WALLET_ID)
    expect(config.id).toBe('passkey')
    expect(config.Adapter).toBe(PasskeyAdapter)
    expect(config.metadata).toEqual(PasskeyAdapter.defaultMetadata)
    expect(config.options).toBeUndefined()
    expect(config.capabilities).toBeUndefined()
  })

  it('passes adapter options through and applies metadata overrides', () => {
    const config = passkey({ rpId: 'example.com', metadata: { name: 'Sign in with passkey' } })
    expect(config.options).toEqual({ rpId: 'example.com' })
    expect(config.metadata.name).toBe('Sign in with passkey')
    expect(config.metadata.icon).toBe(PasskeyAdapter.defaultMetadata.icon)
  })

  it('rejects an invalid context up front', () => {
    expect(() => passkey({ context: 'a:b' })).toThrow('must not contain ":"')
  })
})
