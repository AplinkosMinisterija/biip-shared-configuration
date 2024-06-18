import { Knex } from 'knex';
import { DatabaseMixin, DatabaseMixinOptions } from './database';
import { COMMON_SETTINGS_FIELDS } from '../constants';

export enum TenantUserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export function TenantUsersMixin(
  config: Knex.Config,
  opts?: DatabaseMixinOptions,
  servicesNames = { users: 'users', tenants: 'tenants' },
) {
  return {
    mixins: [DatabaseMixin(config, opts)],
    settings: {
      fields: {
        id: {
          type: 'string',
          columnType: 'integer',
          primaryKey: true,
          secure: true,
        },

        tenant: {
          type: 'number',
          columnName: 'tenantId',
          immutable: true,
          populate: `${servicesNames.tenants}.resolve`,
        },

        user: {
          type: 'number',
          columnName: 'userId',
          immutable: true,
          populate: `${servicesNames.users}.resolve`,
        },

        role: {
          type: 'string',
          enum: Object.values(TenantUserRole),
          default: TenantUserRole.USER,
        },

        ...COMMON_SETTINGS_FIELDS,
      },
    },
  };
}
