import React from "react";
import { render } from "@testing-library/react";
import ConnectWallet from "./Account";

describe("Account", () => {
  test("renders the Account component", () => {
    render(<ConnectWallet foo="bar" />);
  });
});
