import { CustomProvider } from '../../clients/custom/types'
import { Buffer } from 'buffer'
import type _algosdk from 'algosdk'
import { PROVIDER_ID, Metadata } from '../../index'

/**
 * Example of a custom wallet provider that facilitates manual signing via goal CLI using alert / prompt as a UI.
 */
export class ManualGoalSigningAlertPromptProvider implements CustomProvider {
  algosdk: typeof _algosdk

  constructor(algosdkStatic: typeof _algosdk) {
    this.algosdk = algosdkStatic
  }

  // eslint-disable-next-line @typescript-eslint/require-await
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect(_metadata: Metadata) {
    return null
  }

  async signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[] | undefined,
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
        `Here is the unsigned transaction bytes in base64 that needs signing, press OK to copy to clipboard for signing: ${forSigning}`
      )

      console.log('Here is the unsigned transaction bytes in base64 that need signing', forSigning)
      await navigator.clipboard.writeText(forSigning).catch(async (e) => {
        console.warn('Error copying from clipboard, trying again in async thread', e)
        // Try async to avoid permission issue
        await new Promise<void>((resolve, reject) =>
          setTimeout(() => {
            navigator.clipboard
              .writeText(forSigning)
              .then(() => {
                resolve()
              })
              .catch((e) => {
                alert(
                  'Clipboard copy failed; check you have granted permission to clipboard and/or try copying it from the developer console'
                )
                reject(e)
              })
          }, 1)
        )
      })
      const clipboard = await navigator.clipboard.readText().catch((e) => {
        alert(
          'Clipboard copy failed; check you have granted permission to clipboard and/or try copying it from the developer console'
        )
        throw e
      })
      if (clipboard !== forSigning) {
        alert(
          'Clipboard copy failed; check you have granted permission to clipboard and/or try copying it from the developer console'
        )
      }

      alert(`### Signing instructions ###

  1. Check the value landed in your clipboard and if not check the web browser isn't waiting for you to grant permission to clipboard and either way try again or copy the value from the developer console if all else fails (F12)
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
