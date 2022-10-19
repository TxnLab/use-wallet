import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import Wallet from "./Wallet";

export default {
  title: "ReactComponentLibrary/Wallet",
  component: Wallet,
} as ComponentMeta<typeof Wallet>;

const Template: ComponentStory<typeof Wallet> = (args) => <Wallet {...args} />;

export const UseWallet = Template.bind({});

UseWallet.args = {
  foo: "bar",
};
