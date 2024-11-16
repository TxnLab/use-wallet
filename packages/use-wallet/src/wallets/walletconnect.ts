import algosdk from 'algosdk'
import { caipChainId } from 'src/network'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import {
  base64ToByteArray,
  byteArrayToBase64,
  compareAccounts,
  flattenTxnGroup,
  formatJsonRpcRequest,
  isSignedTxn,
  isTransactionArray
} from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { WalletConnectModal, WalletConnectModalConfig } from '@walletconnect/modal'
import type SignClient from '@walletconnect/sign-client'
import type { SessionTypes, SignClientTypes } from '@walletconnect/types'
import type {
  WalletAccount,
  WalletConstructor,
  WalletId,
  WalletTransaction
} from 'src/wallets/types'

interface SignClientOptions {
  projectId: string
  relayUrl?: string
  metadata?: SignClientTypes.Metadata
}

type WalletConnectModalOptions = Pick<
  WalletConnectModalConfig,
  | 'enableExplorer'
  | 'explorerRecommendedWalletIds'
  | 'privacyPolicyUrl'
  | 'termsOfServiceUrl'
  | 'themeMode'
  | 'themeVariables'
>

export type WalletConnectOptions = SignClientOptions & WalletConnectModalOptions

export type SignTxnsResponse = Array<Uint8Array | number[] | string | null | undefined>

export class SessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionError'
  }
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="480" fill="#FFFFFF" />
  <path fill="#3396FF" d="M126.6,168c62.6-61.3,164.2-61.3,226.8,0l7.5,7.4c3.1,3.1,3.1,8,0,11.1l-25.8,25.2c-1.6,1.5-4.1,1.5-5.7,0l-10.4-10.2c-43.7-42.8-114.5-42.8-158.2,0l-11.1,10.9c-1.6,1.5-4.1,1.5-5.7,0l-25.8-25.2c-3.1-3.1-3.1-8,0-11.1L126.6,168zM406.7,220.2l22.9,22.5c3.1,3.1,3.1,8,0,11.1L326.2,355.1c-3.1,3.1-8.2,3.1-11.3,0l-73.4-71.9c-0.8-0.8-2.1-0.8-2.8,0l-73.4,71.9c-3.1,3.1-8.2,3.1-11.3,0L50.3,253.8c-3.1-3.1-3.1-8,0-11.1l22.9-22.5c3.1-3.1,8.2-3.1,11.3,0l73.4,71.9c0.8,0.8,2.1,0.8,2.8,0 l73.4-71.9c3.1-3.1,8.2-3.1,11.3,0l73.4,71.9c0.8,0.8,2.1,0.8,2.8,0l73.4-71.9C398.5,217.1,403.6,217.1,406.7,220.2L406.7,220.2z" />
</svg>
`)}`

export class WalletConnect extends BaseWallet {
  private client: SignClient | null = null
  private options: SignClientOptions
  private modal: WalletConnectModal | null = null
  private modalOptions: WalletConnectModalOptions
  private session: SessionTypes.Struct | null = null
  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.WALLETCONNECT>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    if (!options?.projectId) {
      this.logger.error('Missing required option: projectId')
      throw new Error('Missing required option: projectId')
    }

    const {
      projectId,
      relayUrl = 'wss://relay.walletconnect.com',
      metadata: metadataOptions,
      ...modalOptions
    } = options

    const clientMetadata: SignClientTypes.Metadata = {
      ...this.getWindowMetadata(),
      ...metadataOptions
    }

    this.options = {
      projectId,
      relayUrl,
      metadata: clientMetadata
    }

    this.modalOptions = modalOptions
    this.store = store
  }

  static defaultMetadata = {
    name: 'WalletConnect',
    icon: ICON
  }

  /**
   * Get metadata from the current window. This is adapted from the @walletconnect/utils
   * implementation, to avoid requiring the entire package as a dependency.
   * @see https://github.com/WalletConnect/walletconnect-utils/blob/master/browser/window-metadata/src/index.ts
   */
  private getWindowMetadata(): SignClientTypes.Metadata {
    let doc: Document
    let loc: Location

    const defaultMetadata = {
      name: '',
      description: '',
      url: '',
      icons: []
    }

    function getFromWindow<T>(name: string): T | undefined {
      let res: T | undefined
      if (typeof window !== 'undefined' && typeof (window as any)[name] !== 'undefined') {
        res = (window as any)[name]
      }
      return res
    }

    function getFromWindowOrThrow<T>(name: string): T {
      const res = getFromWindow<T>(name)
      if (!res) {
        throw new Error(`${name} is not defined in Window`)
      }
      return res
    }

    function getDocumentOrThrow(): Document {
      return getFromWindowOrThrow<Document>('document')
    }

    function getLocationOrThrow(): Location {
      return getFromWindowOrThrow<Location>('location')
    }

    try {
      doc = getDocumentOrThrow()
      loc = getLocationOrThrow()
    } catch (error) {
      this.logger.warn('Error getting window metadata:', error)
      return defaultMetadata
    }

    function getIcons(): string[] {
      const links: HTMLCollectionOf<HTMLLinkElement> = doc.getElementsByTagName('link')
      const icons: string[] = []

      for (let i = 0; i < links.length; i++) {
        const link: HTMLLinkElement = links[i]

        const rel: string | null = link.getAttribute('rel')
        if (rel) {
          if (rel.toLowerCase().indexOf('icon') > -1) {
            const href: string | null = link.getAttribute('href')

            if (href) {
              if (
                href.toLowerCase().indexOf('https:') === -1 &&
                href.toLowerCase().indexOf('http:') === -1 &&
                href.indexOf('//') !== 0
              ) {
                let absoluteHref: string = loc.protocol + '//' + loc.host

                if (href.indexOf('/') === 0) {
                  absoluteHref += href
                } else {
                  const path: string[] = loc.pathname.split('/')
                  path.pop()
                  const finalPath: string = path.join('/')
                  absoluteHref += finalPath + '/' + href
                }

                icons.push(absoluteHref)
              } else if (href.indexOf('//') === 0) {
                const absoluteUrl: string = loc.protocol + href

                icons.push(absoluteUrl)
              } else {
                icons.push(href)
              }
            }
          }
        }
      }

      return icons
    }

    function getWindowMetadataOfAny(...args: string[]): string {
      const metaTags: HTMLCollectionOf<HTMLMetaElement> = doc.getElementsByTagName('meta')

      for (let i = 0; i < metaTags.length; i++) {
        const tag: HTMLMetaElement = metaTags[i]
        const attributes: Array<string | null> = ['itemprop', 'property', 'name']
          .map((target: string) => tag.getAttribute(target))
          .filter((attr: string | null) => {
            if (attr) {
              return args.includes(attr)
            }
            return false
          })

        if (attributes.length && attributes) {
          const content: string | null = tag.getAttribute('content')
          if (content) {
            return content
          }
        }
      }

      return ''
    }

    function getName(): string {
      let name: string = getWindowMetadataOfAny('name', 'og:site_name', 'og:title', 'twitter:title')

      if (!name) {
        name = doc.title
      }

      return name
    }

    function getDescription(): string {
      const description: string = getWindowMetadataOfAny(
        'description',
        'og:description',
        'twitter:description',
        'keywords'
      )

      return description
    }

    const name: string = getName()
    const description: string = getDescription()
    const url: string = loc.origin
    const icons: string[] = getIcons()

    const meta: SignClientTypes.Metadata = {
      description,
      url,
      icons,
      name
    }

    return meta
  }

  private async initializeClient(): Promise<SignClient> {
    this.logger.info('Initializing client...')
    const SignClient = (await import('@walletconnect/sign-client')).SignClient
    const client = await SignClient.init(this.options)

    client.on('session_event', (args) => {
      this.logger.info('EVENT: session_event', args)
    })

    client.on('session_update', ({ topic, params }) => {
      this.logger.info('EVENT: session_update', { topic, params })
      const { namespaces } = params
      const session = client.session.get(topic)
      const updatedSession = { ...session, namespaces }
      this.onSessionConnected(updatedSession)
    })

    client.on('session_delete', () => {
      this.logger.info('EVENT: session_delete')
      this.session = null
    })

    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  private async initializeModal(): Promise<WalletConnectModal> {
    this.logger.info('Initializing modal...')
    const WalletConnectModal = (await import('@walletconnect/modal')).WalletConnectModal
    const modal = new WalletConnectModal({
      projectId: this.options.projectId,
      ...this.modalOptions
    })

    modal.subscribeModal((state) => this.logger.info(`Modal ${state.open ? 'open' : 'closed'}`))

    this.modal = modal
    this.logger.info('Modal initialized')
    return modal
  }

  private onSessionConnected(session: SessionTypes.Struct): WalletAccount[] {
    const caipAccounts = session.namespaces.algorand!.accounts

    if (!caipAccounts.length) {
      this.logger.error('No accounts found!')
      throw new Error('No accounts found!')
    }

    // @todo: Validate format of CAIP-10 accounts

    // Filter duplicate accounts (same address, different chain)
    const accounts = [...new Set(caipAccounts.map((account) => account.split(':').pop()!))]

    const walletAccounts = accounts.map((address: string, idx: number) => ({
      name: `${this.metadata.name} Account ${idx + 1}`,
      address
    }))

    const state = this.store.state
    const walletState = state.wallets[this.id]

    if (!walletState) {
      const newWalletState: WalletState = {
        accounts: walletAccounts,
        activeAccount: walletAccounts[0]
      }

      addWallet(this.store, {
        walletId: this.id,
        wallet: newWalletState
      })

      this.logger.info('Connected', newWalletState)
    } else {
      const match = compareAccounts(walletAccounts, walletState.accounts)

      if (!match) {
        this.logger.warn('Session accounts mismatch, updating accounts', {
          prev: walletState.accounts,
          current: walletAccounts
        })
        setAccounts(this.store, {
          walletId: this.id,
          accounts: walletAccounts
        })
      }
    }

    this.session = session
    return walletAccounts
  }

  public get activeChainId(): string {
    const chainId = caipChainId[this.activeNetwork]
    if (!chainId) {
      this.logger.warn(`No CAIP-2 chain ID found for network: ${this.activeNetwork}`)
      return ''
    }
    return chainId
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    try {
      const client = this.client || (await this.initializeClient())
      const modal = this.modal || (await this.initializeModal())

      const requiredNamespaces = {
        algorand: {
          chains: [this.activeChainId],
          methods: ['algo_signTxn'],
          events: []
        }
      }

      const { uri, approval } = await client.connect({ requiredNamespaces })

      if (!uri) {
        this.logger.error('No URI found')
        throw new Error('No URI found')
      }

      await modal.openModal({ uri })

      const session = await approval()
      const walletAccounts = this.onSessionConnected(session)

      this.logger.info('Connected successfully')
      return walletAccounts
    } catch (error: any) {
      this.logger.error('Error connecting:', error.message)
      throw error
    } finally {
      this.modal?.closeModal()
    }
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    try {
      this.onDisconnect()
      if (this.client && this.session) {
        await this.client.disconnect({
          topic: this.session.topic,
          reason: {
            message: 'User disconnected.',
            code: 6000
          }
        })
      }
      this.logger.info('Disconnected')
    } catch (error: any) {
      this.logger.error('Error disconnecting:', error.message)
      throw error
    }
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      // No session to resume
      if (!walletState) {
        this.logger.info('No session to resume')
        return
      }

      this.logger.info('Resuming session...')

      const client = this.client || (await this.initializeClient())

      if (client.session.length) {
        const lastKeyIndex = client.session.keys.length - 1
        const restoredSession = client.session.get(client.session.keys[lastKeyIndex])
        this.onSessionConnected(restoredSession)
      }
      this.logger.info('Session resumed successfully')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
      this.onDisconnect()
      throw error
    }
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = this.addresses.includes(signer)

      const txnString = byteArrayToBase64(txn.toByte())

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn: txnString })
      } else {
        txnsToSign.push({ txn: txnString, signers: [] })
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

    txnGroup.forEach((txnBuffer, index) => {
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = !isSigned && this.addresses.includes(signer)

      const txnString = byteArrayToBase64(txn.toByte())

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn: txnString })
      } else {
        txnsToSign.push({ txn: txnString, signers: [] })
      }
    })

    return txnsToSign
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    try {
      if (!this.session) {
        this.logger.error('No session found!')
        throw new SessionError('No session found!')
      }

      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })

      let txnsToSign: WalletTransaction[] = []

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      const client = this.client || (await this.initializeClient())

      this.logger.debug('Sending processed transactions to wallet...', [txnsToSign])

      // Format JSON-RPC request
      const request = formatJsonRpcRequest('algo_signTxn', [txnsToSign])

      // Sign transactions
      const signTxnsResult = await client.request<SignTxnsResponse>({
        chainId: this.activeChainId,
        topic: this.session.topic,
        request
      })

      this.logger.debug('Received signed transactions from wallet', signTxnsResult)

      // Filter out unsigned transactions, convert signed transactions to Uint8Array
      const signedTxns = signTxnsResult.reduce<Uint8Array[]>((acc, value) => {
        if (value) {
          let signedTxn: Uint8Array
          if (typeof value === 'string') {
            signedTxn = base64ToByteArray(value)
          } else if (value instanceof Uint8Array) {
            signedTxn = value
          } else if (Array.isArray(value)) {
            signedTxn = new Uint8Array(value)
          } else {
            // Log unexpected types for debugging
            this.logger.warn('Unexpected type in signTxnsResult', value)
            signedTxn = new Uint8Array()
          }
          acc.push(signedTxn)
        }
        return acc
      }, [])

      // ARC-0001 - Return null for unsigned transactions
      const result = txnsToSign.reduce<(Uint8Array | null)[]>((acc, txn) => {
        if (txn.signers && txn.signers.length == 0) {
          acc.push(null)
        } else {
          const signedTxn = signedTxns.shift()
          if (signedTxn) {
            acc.push(signedTxn)
          }
        }
        return acc
      }, [])

      this.logger.debug('Transactions signed successfully', result)
      return result
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
