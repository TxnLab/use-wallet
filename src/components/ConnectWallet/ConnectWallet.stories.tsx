import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";
import ConnectWallet from "./ConnectWallet";

export default {
  title: "ReactComponentLibrary/ConnectWallet",
  component: ConnectWallet,
} as ComponentMeta<typeof ConnectWallet>;

const Template: ComponentStory<typeof ConnectWallet> = (args) => (
  <ConnectWallet {...args} />
);

export const UseConnectWallet = Template.bind({});

UseConnectWallet.args = {
  foo: "bar",
};
