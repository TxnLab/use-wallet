import { JsonRpcRequest } from './types'

const getPayloadId = (): number => {
  const date = Date.now() * Math.pow(10, 3)
  const extra = Math.floor(Math.random() * Math.pow(10, 3))
  return date + extra
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatJsonRpcRequest = <T = any>(method: string, params: T): JsonRpcRequest => {
  return {
    id: getPayloadId(),
    jsonrpc: '2.0',
    method,
    params
  }
}
