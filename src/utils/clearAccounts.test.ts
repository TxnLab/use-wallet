import * as clearAccounts from './clearAccounts'
import * as constants from '../constants/constants'

describe('clearAccounts.clearAccounts', () => {
  it.each([
    [constants.PROVIDER_ID.ALGOSIGNER],
    [constants.PROVIDER_ID.MYALGO],
    [constants.PROVIDER_ID.PERA],
    [constants.PROVIDER_ID.EXODUS]
  ])('clears account for %p', (provider: constants.PROVIDER_ID) => {
    const result: any = clearAccounts.clearAccounts(provider)
    expect(result).toMatchSnapshot()
  })
})
