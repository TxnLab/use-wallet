import React from "react";
import useWallet from "../hooks/v1/useWallet";
import { PROVIDER_ID } from "../hooks/v1/useWallet";

export default function Test() {
  const { clients, providers } = useWallet();

  console.log("providers", providers);

  const handleClick = async () => {
    (await clients?.[PROVIDER_ID.DEFLY])?.connect(() =>
      console.log("disconnected")
    );
  };

  return (
    <div>
      <button onClick={handleClick}>TEST</button>

      {providers.map((provider) => {
        return (
          <div>
            <p>{provider.metadata.id}</p>
            <img width={30} height={30} src={provider.metadata.icon} />
          </div>
        );
      })}
    </div>
  );
}
