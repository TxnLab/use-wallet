/**
 * Fallback configuration for Webpack to handle optional wallet dependencies.
 * This allows applications to build without these packages installed,
 * enabling users to include only the wallet packages they need.
 * Each package is set to 'false', which means Webpack will provide an empty module
 * if the package is not found, preventing build errors for unused wallets.
 */
export const webpackFallback = {
  '@agoralabs-sh/avm-web-provider': false,
  '@blockshake/defly-connect': false,
  '@magic-ext/algorand': false,
  '@perawallet/connect': false,
  '@walletconnect/modal': false,
  '@walletconnect/sign-client': false,
  '@web3auth/base': false,
  '@web3auth/base-provider': false,
  '@web3auth/modal': false,
  '@web3auth/single-factor-auth': false,
  'lute-connect': false,
  'magic-sdk': false
}
