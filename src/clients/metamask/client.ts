/**
 * Helpful resources:
 * https://github.com/PureStake/algosigner/blob/develop/docs/dApp-integration.md
 */
import type _algosdk from 'algosdk'
import BaseWallet from '../base'
import Algod, { getAlgodClient } from '../../algod'
import { PROVIDER_ID, DEFAULT_NETWORK } from '../../constants'
import type { DecodedTransaction, DecodedSignedTransaction, Network } from '../../types'
import { ICON } from './constants'
import type {
  WindowExtended,
  AlgoSignerTransaction,
  AlgoSigner,
  MetamaskClientConstructor,
  InitParams
} from './types'
import { useWalletStore } from '../../store'
import {Wallet} from 'snapalgo-sdk';


class MetamaskClient extends BaseWallet {
  #client: any
  network: Network
  walletStore: typeof useWalletStore
  init: boolean

  constructor({ metadata, client, algosdk, algodClient, network }: MetamaskClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.network = network
    this.walletStore = useWalletStore
    this.init = false
  }

  static metadata = {
    id: PROVIDER_ID.METAMASK,
    name: 'Metamask',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({ algodOptions, algosdkStatic, network = DEFAULT_NETWORK }: InitParams) {
    
      

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const client = Wallet;

      return new MetamaskClient({
        metadata: MetamaskClient.metadata,
        client: client,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      })

  }

  async connect() {
    
    if(this.init === false){
      this.#client = new Wallet();
    }
    console.log(this.getGenesisID());
    const { accounts } = await this.#client.enable({ genesisID: this.getGenesisID() })
    console.log("accounts is")
    console.log(accounts);

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${MetamaskClient.metadata.id}`)
    }

    const mappedAccounts = await Promise.all(
      accounts.map(async (address:string, index:any) => {
        // check to see if this is a rekeyed account
        const { 'auth-addr': authAddr } = await this.getAccountInfo(address)
        
        const currentAccountInfo:any = await (window as WindowExtended)?.ethereum.request({  
            method: 'wallet_invokeSnap',
            params:{        
              snapId:'npm:@algorandfoundation/algorand-metamask-snap',
              request:{
                method: 'getCurrentAccount',
              }
            }
        })
      

        return {
          name: currentAccountInfo.name,
          address,
          providerId: MetamaskClient.metadata.id,
          ...(authAddr && { authAddr })
        }
      })
    )

    // sort the accounts in the order they were returned by AlgoSigner
    mappedAccounts.sort((a, b) => accounts.indexOf(a.address) - accounts.indexOf(b.address))
    this.init = true;
    return {
      ...MetamaskClient.metadata,
      accounts: mappedAccounts
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect(onDisconnect: () => void) {
    if (window === undefined || (window as WindowExtended).algorand === undefined) {
      onDisconnect()
    }

    return null
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect() {
    //disconnect not supported by metamask
    return
  }

  async signTransactions(
    connectedAccounts: string[],
    transactions: Uint8Array[],
    indexesToSign?: number[],
    returnGroup = true
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      let rawTxn = this.algosdk.decodeObj(txn);
      return rawTxn;
    }) as Array<DecodedTransaction | DecodedSignedTransaction>

    const signedIndexes: number[] = []

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<AlgoSignerTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      const sender = this.algosdk.encodeAddress(isSigned ? txn.txn.snd : txn.snd)
      const authAddress = this.getAuthAddress(sender) // rekeyed-to account, or undefined

      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push({
          txn: this.#client.base64Encode(transactions[i]),
          ...(authAddress && { authAddr: authAddress })
        })
      } else if (!isSigned && connectedAccounts.includes(sender)) {
        signedIndexes.push(i)
        acc.push({
          txn: this.#client.base64Encode(transactions[i]),
          ...(authAddress && { authAddr: authAddress })
        })
      } else {
        acc.push({
          txn: this.#client.base64Encode(
            isSigned
              ? this.algosdk.decodeSignedTransaction(transactions[i]).txn.toByte()
              : this.algosdk.decodeUnsignedTransaction(transactions[i]).toByte()
          ),
          signers: []
        })
      }

      return acc
    }, [])

    // Sign them with the client.
    const result = await this.#client.signTxns(txnsToSign)

    // Join the newly signed transactions with the original group of transactions
    // if `returnGroup` is true
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = result[i]
        signedByUser && acc.push(new Uint8Array(Buffer.from(signedByUser, 'base64')))
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }

  getGenesisID() {
    if (this.network === 'betanet') {
      return 'betanet-v1.0'
    }
    if (this.network === 'testnet') {
      return 'testnet-v1.0'
    }
    if (this.network === 'mainnet') {
      return 'mainnet-v1.0'
    }
    return this.network
  }

  getAuthAddress(address: string): string | undefined {
    const accounts = this.walletStore.getState().accounts
    const account = accounts.find(
      (acct) => acct.address === address && acct.providerId === this.metadata.id
    )

    return account?.authAddr
  }
}

export default MetamaskClient
