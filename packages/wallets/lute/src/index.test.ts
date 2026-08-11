import { lute, LuteAdapter, WALLET_ID } from './index'

describe('lute factory', () => {
  it('returns config with default metadata', () => {
    const config = lute()

    expect(config.id).toBe(WALLET_ID)
    expect(config.metadata).toEqual(LuteAdapter.defaultMetadata)
    expect(config.options).toBeUndefined()
  })

  it('merges metadata overrides with default metadata', () => {
    const config = lute({ metadata: { name: 'Custom Name' } })

    expect(config.metadata).toEqual({
      ...LuteAdapter.defaultMetadata,
      name: 'Custom Name'
    })
  })

  it('does not pass metadata through to adapter options', () => {
    const config = lute({ metadata: { name: 'Custom Name' } })

    expect(config.options).toBeUndefined()
  })

  it('passes adapter options through without metadata', () => {
    const config = lute({ siteName: 'My dApp', metadata: { icon: 'data:custom-icon' } })

    expect(config.options).toEqual({ siteName: 'My dApp' })
    expect(config.metadata).toEqual({
      ...LuteAdapter.defaultMetadata,
      icon: 'data:custom-icon'
    })
  })
})
