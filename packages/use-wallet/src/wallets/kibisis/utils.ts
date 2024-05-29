import type { BaseARC0027Error } from '@agoralabs-sh/avm-web-provider';

export function isAVMWebProviderSDKError(error: any): error is BaseARC0027Error {
  return typeof error === 'object' && 'code' in error && 'message' in error
}
