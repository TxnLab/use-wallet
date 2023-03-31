/* eslint-disable @typescript-eslint/no-empty-function */
import * as clearAccounts from './clearAccounts'
import * as constants from '../constants/constants'

describe('clearAccounts.clearAccounts', () => {
  beforeEach(() => {
    // Mock console.warn to avoid polluting the test output
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    [constants.PROVIDER_ID.ALGOSIGNER],
    [constants.PROVIDER_ID.MYALGO],
    [constants.PROVIDER_ID.PERA],
    [constants.PROVIDER_ID.EXODUS]
  ])('clears account for %p', (provider: constants.PROVIDER_ID) => {
    const result = clearAccounts.clearAccounts(provider)
    expect(result).toMatchSnapshot()
  })
})
