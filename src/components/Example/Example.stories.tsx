import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";
import Example from "./Example";

export default {
  title: "ReactComponentLibrary/Example",
  component: Example,
} as ComponentMeta<typeof Example>;

const Template: ComponentStory<typeof Example> = (args) => <Example />;

export const ExampleStory = Template.bind({});

ExampleStory.args = {
  foo: "bar",
};
