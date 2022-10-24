import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";
import Account from "./Account";

export default {
  title: "ReactComponentLibrary/Account",
  component: Account,
} as ComponentMeta<typeof Account>;

const Template: ComponentStory<typeof Account> = (args) => (
  <Account {...args} />
);

export const ActiveAccount = Template.bind({});

ActiveAccount.args = {
  foo: "bar",
};
