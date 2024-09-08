import { AVMProvider } from 'src/wallets/avm-web-provider'
import { WalletId, type WalletConstructor } from 'src/wallets/types'
import type AVMWebProviderSDK from '@agoralabs-sh/avm-web-provider'

export const DEFLY_WEB_PROVIDER_ID = '95426e60-5f2e-49e9-b912-c488577be962'

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" />
  <path fill="#FFFFFF" d="M779.9,684.4L512,230L244.1,684.4L512,529.5L779.9,684.4z" />
  <path fill="#FFFFFF" d="M733.1,730L512,613.5L290.9,730L512,658L733.1,730z" />
</svg>
`)}`

export class DeflyWebWallet extends AVMProvider {
  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    metadata = {}
  }: WalletConstructor<WalletId.DEFLY>) {
    super({
      id,
      metadata,
      getAlgodClient,
      store,
      subscribe,
      providerId: DEFLY_WEB_PROVIDER_ID
    })
  }

  static defaultMetadata = {
    name: 'Defly Web Wallet',
    icon: ICON
  }

  protected async _enable(): Promise<AVMWebProviderSDK.IEnableResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      DEFAULT_REQUEST_TIMEOUT
    } = await this._initializeAVMWebProviderSDK()
    const avmWebClient = await this._initializeAVMWebClient()
    const genesisHash = await this._getGenesisHash()

    return new Promise<AVMWebProviderSDK.IEnableResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        avmWebClient.removeListener(listenerId)
        reject(
          new ARC0027MethodTimedOutError({
            method: ARC0027MethodEnum.Enable,
            message: `no response from provider "${this.metadata.name}"`,
            providerId: DEFLY_WEB_PROVIDER_ID
          })
        )
      }, DEFAULT_REQUEST_TIMEOUT)
      const listenerId = avmWebClient.onEnable(({ error, method, result }) => {
        avmWebClient.removeListener(listenerId)
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(
            new ARC0027UnknownError({
              message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
              providerId: DEFLY_WEB_PROVIDER_ID
            })
          )
        }

        return resolve(result)
      })

      avmWebClient.enable({
        genesisHash,
        providerId: DEFLY_WEB_PROVIDER_ID
      })
    })
  }

  protected async _disable(): Promise<AVMWebProviderSDK.IDisableResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      LOWER_REQUEST_TIMEOUT
    } = await this._initializeAVMWebProviderSDK()
    const avmWebClient = await this._initializeAVMWebClient()
    const genesisHash = await this._getGenesisHash()

    return new Promise<AVMWebProviderSDK.IDisableResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        avmWebClient.removeListener(listenerId)
        reject(
          new ARC0027MethodTimedOutError({
            method: ARC0027MethodEnum.Disable,
            message: `no response from provider "${this.metadata.name}"`,
            providerId: DEFLY_WEB_PROVIDER_ID
          })
        )
      }, LOWER_REQUEST_TIMEOUT)
      const listenerId = avmWebClient.onDisable(({ error, method, result }) => {
        avmWebClient.removeListener(listenerId)
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(
            new ARC0027UnknownError({
              message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
              providerId: DEFLY_WEB_PROVIDER_ID
            })
          )
        }

        return resolve(result)
      })

      avmWebClient.disable({
        genesisHash,
        providerId: DEFLY_WEB_PROVIDER_ID
      })
    })
  }

  protected async _signTransactions(
    txns: AVMWebProviderSDK.IARC0001Transaction[]
  ): Promise<AVMWebProviderSDK.ISignTransactionsResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      DEFAULT_REQUEST_TIMEOUT
    } = await this._initializeAVMWebProviderSDK()
    const avmWebClient = await this._initializeAVMWebClient()

    return new Promise<AVMWebProviderSDK.ISignTransactionsResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        avmWebClient.removeListener(listenerId)
        reject(
          new ARC0027MethodTimedOutError({
            method: ARC0027MethodEnum.SignTransactions,
            message: `no response from provider "${this.metadata.name}"`,
            providerId: DEFLY_WEB_PROVIDER_ID
          })
        )
      }, DEFAULT_REQUEST_TIMEOUT)
      const listenerId = avmWebClient.onSignTransactions(({ error, method, result }) => {
        avmWebClient.removeListener(listenerId)
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(
            new ARC0027UnknownError({
              message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
              providerId: DEFLY_WEB_PROVIDER_ID
            })
          )
        }

        return resolve(result)
      })

      avmWebClient.signTransactions({
        txns,
        providerId: DEFLY_WEB_PROVIDER_ID
      })
    })
  }
}
