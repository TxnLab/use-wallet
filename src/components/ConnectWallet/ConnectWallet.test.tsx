import React from "react";
import { render } from "@testing-library/react";
import ConnectWallet from "./ConnectWallet";

describe("Wallet", () => {
  test("renders the Wallet component", () => {
    render(<ConnectWallet foo="bar" />);
  });
});
