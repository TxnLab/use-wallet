import { createContext } from 'react'
import { SupportedProviders } from '../../types'

const ClientContext = createContext<SupportedProviders | null>(null)

export { ClientContext }

export default ClientContext.Provider
