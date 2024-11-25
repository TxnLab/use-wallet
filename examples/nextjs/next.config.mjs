import { webpackFallback } from '@txnlab/use-wallet-react'

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    /** @see https://github.com/WalletConnect/walletconnect-monorepo/issues/1908#issuecomment-1487801131 */
    config.externals.push('pino-pretty', 'lokijs', 'encoding')

    /**
     * Provide fallbacks for optional wallet dependencies.
     * This allows the app to build and run without these packages installed,
     * enabling users to include only the wallet packages they need.
     * Each package is set to 'false', which means Webpack will provide an empty module
     * if the package is not found, preventing build errors for unused wallets.
     */
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...webpackFallback
      }
    }
    return config
  }
}

export default nextConfig
