import React from "react";
import { useConnectWallet } from "../../index";
import "./ConnectWallet.scss";

type ConnectWalletProps = {
  foo?: string;
};

export default function ConnectWallet(props: ConnectWalletProps) {
  const {
    providers,
    reconnectProviders,
    accounts,
    activeAccount,
    selectActiveAccount,
  } = useConnectWallet();

  // Reconnect the session when the user returns to the dApp
  React.useEffect(() => {
    reconnectProviders();
  }, []);

  // Use these properties to display connected accounts to users.
  React.useEffect(() => {
    console.log("connected accounts", accounts);
    console.log("active account", activeAccount);
  });

  // Map through the providers, and render "connect", "set active", and "disconnect" buttons
  return (
    <div>
      {providers.map((provider) => (
        <div key={"provider-" + provider.id}>
          <h4>
            <img width={30} height={30} src={provider.icon} />
            {provider.name} {provider.isActive && "[active]"}
          </h4>
          <div>
            <button onClick={provider.connect} disabled={provider.isConnected}>
              Connect
            </button>
            <button
              onClick={provider.disconnect}
              disabled={!provider.isConnected}
            >
              Disonnect
            </button>
            <button
              onClick={provider.setActive}
              disabled={!provider.isConnected || provider.isActive}
            >
              Set Active
            </button>
            {activeAccount && activeAccount.providerId === provider.id && (
              <div>
                <select
                  value={activeAccount.address}
                  onChange={(e) =>
                    selectActiveAccount(
                      activeAccount.providerId,
                      e.target.value
                    )
                  }
                >
                  {accounts.map((account) => (
                    <option value={account.address}>{account.address}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
