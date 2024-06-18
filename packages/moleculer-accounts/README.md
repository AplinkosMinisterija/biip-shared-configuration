# BĮIP Moleculer Accounts

## Usage

1. **Install the Package**

   To get started, you need to install the `@aplinkosministerija/moleculer-accounts` package. You can do this using `yarn` or `npm`:

   ```bash
   yarn add @aplinkosministerija/moleculer-accounts
   npm install @aplinkosministerija/moleculer-accounts
   ```

2. **Use in action**

   ```js
   import { DatabaseMixin } from '@aplinkosministerija/moleculer-accounts';

   export const YourService = {
     name: 'serviceName',
     mixins: [DatabaseMixin(knexConfig, options)],
   };
   ```
