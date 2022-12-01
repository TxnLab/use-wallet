import { createContext } from "react";
import { PROVIDER_ID } from "src/constants";
import BaseWallet from "../../clients/v1/base";

type Context = Partial<{ [key in PROVIDER_ID]: Promise<BaseWallet> }>;

const ClientContext = createContext<Context | null>(null);

export { ClientContext };

export default ClientContext.Provider;
