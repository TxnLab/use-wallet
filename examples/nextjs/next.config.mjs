/** @type {import('next').NextConfig} */
const nextConfig = {
  /** @see https://github.com/WalletConnect/walletconnect-monorepo/issues/1908#issuecomment-1487801131 */
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  }
}

export default nextConfig
