# BĮIP Shared Configuration

Welcome to the shared configuration repository for BIIP projects. This README will guide you on how to use the shared
configuration effectively in your projects.

## Usage

### JavaScript packages

#### Prettier Shared Configuration

Using the shared Prettier configuration is straightforward and helps maintain consistent code formatting across BĮIP
projects.

1. **Install the Package**

   To get started, you need to install the `@aplinkosministerija/biip-prettier-config` package, which exports a Prettier
   configuration object. You can do this using `yarn`:

   ```bash
   yarn add --dev @aplinkosministerija/biip-prettier-config
   ```

2. **Reference the Configuration in `package.json`**

   Once the package is installed, you should reference it in your project's `package.json` file. This ensures that your
   project uses the shared Prettier configuration:

   ```json
   {
     "name": "my-cool-application",
     "version": "1.0.0",
     "prettier": "@aplinkosministerija/biip-prettier-config"
   }
   ```

   Now, your Prettier settings will align with the BĮIP shared configuration, making it easy to maintain consistent code
   formatting.

**Pro-tip**: After adding it to your project, reformat your entire codebase using the following command:

```bash
yarn prettier . --write
```

#### ESLint Shared Configuration

There are multiple ESLint shared configuration packages available for different project types:

- `@aplinkosministerija/eslint-config-biip-api` - for configuring ESLint for API projects.
- `@aplinkosministerija/eslint-config-biip-react` - for configuring ESLint for React applications.

Follow these steps to incorporate the shared ESLint configuration into your project:

1. **Install the Package**

   To get started, you need to install the `@aplinkosministerija/eslint-config-biip` package, which exports a ESLint
   configuration object. You can do this using `yarn`:

   ```bash
   yarn add --dev @aplinkosministerija/eslint-config-biip-api
   ```

2. **Reference the Configuration in `package.json`**

   Once the package is installed, you should reference it in your project's `package.json` file. This ensures that your
   project uses the shared ESLint configuration:

   ```json
   {
     "name": "my-cool-application",
     "version": "1.0.0",
     "eslintConfig": {
       "extends": "@aplinkosministerija/eslint-config-biip-api"
     }
   }
   ```

   Now, your ESLint settings will align with the BIIP shared configuration, making it easy to maintain consistent code
   quality and formatting. .

**Pro-tip**: After adding it to your project, auto-fix your entire codebase using the following command:

```bash
yarn lint --fix
```
#### Moleculer Accounts

Follow these steps to incorporate the shared accounts package into your project:

1. **Install the Package**

   To get started, you need to install the `@aplinkosministerija/moleculer-accounts` package. You can do this using `yarn` or `npm`:

   ```bash
   yarn add @aplinkosministerija/moleculer-accounts
   npm install @aplinkosministerija/moleculer-accounts
   ```

2. **Import package into your code**

   ```js
   import { DatabaseMixin } from '@aplinkosministerija/moleculer-accounts';
   ```

   Now you can shine

3. **Documentation**

   For more documentation visit [moleculer-accounts package](/packages/moleculer-accounts/README.md)


### Docker images

#### Caddy BĮIP Docker Image

The BĮIP team uses a customized Docker image for Caddy, which includes additional plugins.
See [here](https://github.com/AplinkosMinisterija/biip-shared-configuration/pkgs/container/biip-caddy) for more
information on how to use it.

## Release

### Creating a New Package Release

Here are the steps to create a new package release:

1. **Execute the `packages:changeset` Command**

   Run the following command on your local computer to generate a changeset:

   ```bash
   yarn packages:changeset
   ```

   This command will create a changeset for your package's changes.

2. **Push the Changeset**

   After running the `packages:changeset` command, you'll see changes in your project. Push these changes, including the
   changeset file, to the repository. This step is essential to trigger the release process.

   After this push, a pull request will be automatically generated in the `main` branch.

3. **Merge the Pull Request**

   Once the pull request is reviewed and approved, you can merge it into the `main` branch. Upon merging, the packages
   will be automatically pushed, and your changes will be released.

By following these steps, you can ensure that your BĮIP package releases are well-organized and consistent.

### Creating Caddy docker image

In order to publish BĮIP customized Caddy docker image:

1. Go
   to [`Publish: Caddy docker iamge`](https://github.com/AplinkosMinisterija/biip-shared-configuration/actions/workflows/publish-caddy-docker.yml)
   workflow GitHub action;
2. Enter image tag with Caddy version that you like to push e.g. `2.7.5` and run workflow.

3. New BĮIP customized Caddy docker image will be pushed. 