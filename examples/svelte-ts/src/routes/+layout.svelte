<script lang="ts">
  import '../app.css'
  import { NetworkId, useWalletContext, WalletId, WalletManager } from '@txnlab/use-wallet-svelte'

  const manager = new WalletManager({
    wallets: [
      WalletId.DEFLY,
      WalletId.DEFLY_WEB,
      WalletId.EXODUS,
      WalletId.PERA,
      {
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
      },
      {
        id: WalletId.BIATEC,
        options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
      },
      WalletId.KMD,
      WalletId.KIBISIS,
      WalletId.LUTE,
      {
        id: WalletId.MAGIC,
        options: { apiKey: 'pk_live_D17FD8D89621B5F3' }
      },
      WalletId.MNEMONIC
    ],
    defaultNetwork: NetworkId.TESTNET
  })

  useWalletContext(manager)

  let { children } = $props()
</script>

{@render children()}
