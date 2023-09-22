import { PublicNetwork } from 'src/types'

export const isPublicNetwork = (network: string): network is PublicNetwork => {
  return network === 'betanet' || network === 'testnet' || network === 'mainnet'
}
