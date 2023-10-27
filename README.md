# BĮIP Shared Configuration

Welcome to the shared configuration repository for BIIP projects. This README will guide you on how to use the shared
configuration effectively in your projects.

## Usage

### Prettier Configuration

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

