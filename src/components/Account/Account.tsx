import React from "react";
import { useWallet } from "../../index";
import { NODE_NETWORK } from "../../constants";

export type WalletProps = {
  foo?: string;
};

export default function Account(props: WalletProps) {
  const { activeAccount } = useWallet();

  if (!activeAccount) {
    return <p>Connect an account first.</p>;
  }

  return (
    <div>
      <h4>Active Account</h4>
      <p>
        Name: <span>{activeAccount.name}</span>
      </p>
      <p>
        Address: <span>{activeAccount.address}</span>
      </p>
      <p>
        Provider: <span>{activeAccount.providerId}</span>
      </p>
      <p>
        Network: <span>{NODE_NETWORK}</span>
      </p>
    </div>
  );
}
