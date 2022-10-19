import React from "react";
import { render } from "@testing-library/react";
import Wallet from "./Wallet";

describe("Wallet", () => {
  test("renders the Wallet component", () => {
    render(<Wallet foo="bar" />);
  });
});
