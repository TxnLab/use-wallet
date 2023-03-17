import type _algosdk from 'algosdk'
import type { AlgodClientOptions } from '../types'
import { DEFAULT_NODE_BASEURL, DEFAULT_NODE_TOKEN, DEFAULT_NODE_PORT } from '../constants'

export const getAlgosdk = async () => {
  return (await import('algosdk')).default
}

export const getAlgodClient = (
  algosdk: typeof _algosdk,
  algodClientOptions?: AlgodClientOptions
) => {
  const [
    tokenOrBaseClient = DEFAULT_NODE_TOKEN,
    baseServer = DEFAULT_NODE_BASEURL,
    port = DEFAULT_NODE_PORT,
    headers
  ] = algodClientOptions || []

  return new algosdk.Algodv2(tokenOrBaseClient, baseServer, port, headers)
}

export default class Algod {
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2

  constructor(algosdk: typeof _algosdk, algodClient: _algosdk.Algodv2) {
    this.algosdk = algosdk
    this.algodClient = algodClient
  }

  static async init(algodOptions?: AlgodClientOptions) {
    const algosdk = await getAlgosdk()
    const algodClient = getAlgodClient(algosdk, algodOptions)

    return new Algod(algosdk, algodClient)
  }
}
