import React from "react";
import { render } from "@testing-library/react";
import Example from "./Example";

describe("ConnectWallet", () => {
  test("renders the Example component", () => {
    render(<Example />);
  });
});
