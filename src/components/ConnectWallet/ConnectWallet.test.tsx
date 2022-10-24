import React from "react";
import { render } from "@testing-library/react";
import ConnectWallet from "./ConnectWallet";

describe("ConnectWallet", () => {
  test("renders the ConnectWallet component", () => {
    render(<ConnectWallet foo="bar" />);
  });
});
