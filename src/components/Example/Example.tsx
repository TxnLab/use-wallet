import React from 'react'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { DaffiWalletConnect } from '@daffiwallet/connect'
import { WalletProvider, PROVIDER_ID, useInitializeProviders, Metadata, Network } from '../../index'
import Account from './Account'
import Connect from './Connect'
import Transact from './Transact'
import { CustomProvider } from '../../clients/custom/types'
import algosdk from 'algosdk'
import type _algosdk from 'algosdk'
import { Buffer } from 'buffer'
import { ICON as KMDICON } from '../../clients/kmd/constants'

const getDynamicPeraWalletConnect = async () => {
  const PeraWalletConnect = (await import('@perawallet/connect')).PeraWalletConnect
  return PeraWalletConnect
}

class TestManualProvider implements CustomProvider {
  algosdk: typeof _algosdk

  constructor(algosdkStatic: typeof _algosdk) {
    this.algosdk = algosdkStatic
  }

  async connect(metadata: Metadata) {
    let address = prompt('Enter address of your account')
    if (address && !this.algosdk.isValidAddress(address)) {
      alert('Invalid address; please try again')
      address = null
    }
    const authAddress = address
      ? prompt("Enter address of the signing account; leave blank if account hasn't been rekeyed")
      : undefined

    return {
      ...metadata,
      accounts: address
        ? [
            {
              address,
              name: address,
              providerId: PROVIDER_ID.CUSTOM,
              authAddr: authAddress === null || authAddress === address ? undefined : authAddress
            }
          ]
        : []
    }
  }

  async disconnect() {
    //
  }

  async reconnect(_metadata: Metadata) {
    return null
  }

  async signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[] | undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _returnGroup?: boolean | undefined
  ): Promise<Uint8Array[]> {
    // If txnGroups is a nested array, flatten it
    const transactions: Uint8Array[] = Array.isArray(txnGroups[0])
      ? (txnGroups as Uint8Array[][]).flatMap((txn) => txn)
      : (txnGroups as Uint8Array[])

    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn)
    }) as Array<_algosdk.EncodedTransaction | _algosdk.EncodedSignedTransaction>

    const signedTxns: Array<Uint8Array> = []

    let idx = -1
    for (const dtxn of decodedTxns) {
      idx++
      const isSigned = 'txn' in dtxn

      // push the incoming txn into signed, we'll overwrite it later
      signedTxns.push(transactions[idx])

      // Its already signed, skip it
      if (isSigned) {
        continue
        // Not specified in indexes to sign, skip it
      } else if (indexesToSign && indexesToSign.length && !indexesToSign.includes(Number(idx))) {
        continue
      }
      // Not to be signed by our signer, skip it
      else if (!connectedAccounts.includes(this.algosdk.encodeAddress(dtxn.snd))) {
        continue
      }

      const unsignedTxn = this.algosdk.decodeUnsignedTransaction(transactions[idx])

      const forSigning = Buffer.from(
        this.algosdk.encodeObj({
          txn: unsignedTxn.get_obj_for_encoding()
        })
      ).toString('base64')
      alert(
        `Here is the unsigned transaction bytes that needs signing in base64, press OK to copy to clipboard for signing: ${forSigning}`
      )

      console.log(forSigning)
      // Make async to avoid permission issue
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          navigator.clipboard.writeText(forSigning)
          resolve(), 1
        }),
      )

      alert(`### Signing instructions ###

1. Check the value landed in your clipboard and if not check the web browser isn't waiting for you to grant permission to clipboard and either way try again
2. Load the value in the clipboard into a file e.g. unsigned.txn:
    \`echo {paste value} | base64 -d > unsigned.txn\`
3. Inspect it:
    \`goal clerk inspect unsigned.txn\`
4. Sign it e.g.
    \`goal clerk sign -i unsigned.txn -o signed.txn\`
5. Output the signed transaction e.g.
    \`cat signed.txn | base64\`
6. Copy the signed transaction output to clipboard
7. Press OK here and then paste into the next prompt.`)

      const signed = prompt('Provide the base 64 encoded signed transaction')
      if (!signed) {
        throw new Error('Provided invalid signed transaction')
      }

      const encoded = Buffer.from(signed, 'base64')
      signedTxns[idx] = encoded
    }

    return signedTxns
  }
}

export default function ConnectWallet() {
  const walletProviders = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
      { id: PROVIDER_ID.PERA, getDynamicClient: getDynamicPeraWalletConnect },
      { id: PROVIDER_ID.DAFFI, clientStatic: DaffiWalletConnect },
      { id: PROVIDER_ID.EXODUS },
      {
        id: PROVIDER_ID.CUSTOM,
        clientOptions: {
          name: 'Manual with KMD icon',
          icon: KMDICON,
          getProvider: (params: {
            network?: Network
            algod?: algosdk.Algodv2
            algosdkStatic?: typeof algosdk
          }) => {
            return new TestManualProvider(params.algosdkStatic ?? algosdk)
          }
        }
      }
    ]
  })

  return (
    <WalletProvider value={walletProviders}>
      <Account />
      <hr />
      <Connect />
      <hr />
      <Transact />
    </WalletProvider>
  )
}
