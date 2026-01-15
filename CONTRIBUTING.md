# Contributing

First off, thank you for considering contributing to `@txnlab/use-wallet`! It's people like you that make this project such a great tool for the Algorand community.

## Reporting Issues

If you have found an issue with `@txnlab/use-wallet`, please follow these steps:

- Provide a clear description of the issue, including the expected behavior and the actual behavior.
- Provide the version of `@txnlab/use-wallet` you are using, the framework you are using, and any other relevant context about your environment.
- Describe the exact steps which reproduce the problem in as much detail as possible.
- To help triage and fix the issue quickly, please provide a minimal reproducible example.

To create a shareable code example, you can use CodeSandbox (https://codesandbox.io/s/new) or Stackblitz (https://stackblitz.com/).

Feel free to fork any of our examples to reproduce your issue:

| Package                    | Framework         | Examples                                                                                                                              |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@txnlab/use-wallet`       | Vite (Vanilla TS) | [CodeSandbox](https://codesandbox.io/p/devbox/vite-vanilla-ts-mxmghx) / [StackBlitz](https://stackblitz.com/edit/vitejs-vite-cfpybn)  |
| `@txnlab/use-wallet-react` | Vite (React)      | [CodeSandbox](https://codesandbox.io/p/devbox/vite-react-k55gr5) / [StackBlitz](https://stackblitz.com/edit/vitejs-vite-tbsvrz)       |
| `@txnlab/use-wallet-solid` | Vite (Solid)      | [CodeSandbox](https://codesandbox.io/p/devbox/vite-solid-w2gtz2) / [StackBlitz](https://stackblitz.com/edit/solidjs-templates-mnxg4m) |
| `@txnlab/use-wallet-vue`   | Vite (Vue)        | [CodeSandbox](https://codesandbox.io/p/devbox/vite-vue-cznvls) / [StackBlitz](https://stackblitz.com/edit/vitejs-vite-mpwnm1)         |

A public GitHub repository also works. 👌

Please ensure that the reproduction is as minimal as possible. For more information on how to create a minimal reproducible example, please refer to [this guide](https://stackoverflow.com/help/minimal-reproducible-example).

## Suggesting New Features

If you would like to suggest a new feature or enhancement for `@txnlab/use-wallet`, please follow these guidelines:

- Use a clear and descriptive title for the issue to identify the suggestion.
- Provide a step-by-step description of the suggested enhancement in as many details as possible.
- Provide specific examples to demonstrate the steps or point out the part of `@txnlab/use-wallet` where the enhancement could be implemented.

## Development

If you want to contribute to `@txnlab/use-wallet`, please follow these steps to get started:

- Fork the repository.
- Clone the repository.
- Install dependencies.

  ```bash
  pnpm install
  ```

  - We use pnpm v9 as our package manager. If you are not familiar with pnpm, please refer to the [pnpm documentation](https://pnpm.io/cli/install).

  - We use [nvm](https://github.com/nvm-sh/nvm) to manage node versions. Please make sure to use the version mentioned in the `.nvmrc` file.

  ```bash
  nvm use
  ```

- Build all packages.

  ```bash
  pnpm build:packages
  ```

- Implement your changes and tests to files in the packages' `src/` directory and corresponding test files.

- Git stage your changes and commit (see commit guidelines below).

- Submit PR for review (see PR guidelines below).

### Running Examples

- Make sure you have installed dependencies in the repository's root directory.

  ```bash
  pnpm install
  ```

- If you want to run an example against your local changes, navigate to the project in the `examples/` directory and run the following command:

  ```bash
  pnpm dev
  ```

- Alternatively, from the root directory you can run one of the following commands to run an example:

  ```bash
  pnpm example:ts
  pnpm example:react
  pnpm example:solid
  pnpm example:vue
  pnpm example:nextjs
  pnpm example:nuxt
  ```

## Git Commit Guidelines

`TxnLab/use-wallet` is using [Angular Commit Message Conventions](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines).

We have very precise rules over how our git commit messages can be formatted. This leads to **more readable messages** that are easy to follow when looking through the **project history**.

### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

Any line of the commit message cannot be longer than 100 characters! This allows the message to be easier to read on GitHub as well as in various git tools.

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Scope

The scope could be anything specifying the place of the commit change. For example `core`, `react`, `vue`, and `solid` refer to the core library and adapters, while `defly`, `pera`, `lute`, etc. refer to individual wallet clients.

You can use `*` when the change affects more than a single scope.

### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit closes.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

### Revert

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

## Pull Requests

- Pull requests will not be reviewed until all checks pass. Before submitting a pull request, ensure that you have run the following commands in the repository's root directory:

  ```bash
  pnpm lint
  ```

  ```bash
  pnpm prettier
  ```

  ```bash
  pnpm typecheck
  ```

  ```bash
  pnpm test
  ```

- If possible/appropriate, create new tests that fail without your changes and pass with them.

- Pull requests are merged by squashing all commits and editing the commit message if necessary using the GitHub user interface.

- Use an appropriate commit type. Be especially careful with breaking changes.

## Documentation

See the [GitBook documentation](https://txnlab.gitbook.io/use-wallet/) for configuration and usage details, including guides for supported frameworks. For documentation issues and feature requests, please [open an issue](https://github.com/txnlab/use-wallet/issues/new/choose).

## Contact

If you have any questions, please join our [Discord server](https://discord.gg/7XcuMTfeZP). Discussion related to `@txnlab/use-wallet` takes place in the `#use-wallet` channel.

Thank you for contributing to `@txnlab/use-wallet`!
