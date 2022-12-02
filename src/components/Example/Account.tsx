import React from "react";
import { useWallet } from "../../index";

export default function Account() {
  const { selectedAccount } = useWallet();

  if (!selectedAccount) {
    return <p>Connect an account first.</p>;
  }

  return (
    <div>
      <h4>Active Account</h4>
      <p>
        Name: <span>{selectedAccount.name}</span>
      </p>
      <p>
        Address: <span>{selectedAccount.address}</span>
      </p>
      <p>
        Provider: <span>{selectedAccount.providerId}</span>
      </p>
    </div>
  );
}
