import { createContext } from 'react'
import { SupportedProviders } from 'src/types'

const ClientContext = createContext<SupportedProviders | null>(null)

export { ClientContext }

export default ClientContext.Provider
