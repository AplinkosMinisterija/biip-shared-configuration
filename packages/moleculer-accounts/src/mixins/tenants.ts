import { Knex } from 'knex';
import { DatabaseMixin, DatabaseMixinOptions } from './database';
import { COMMON_FIELDS } from '../constants';

export function TenantsMixin(config: Knex.Config, opts?: DatabaseMixinOptions) {
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

        name: 'string',

        email: 'email',

        phone: {
          type: 'string',
          // TODO: validate
        },

        authGroup: {
          type: 'number',
          columnType: 'integer',
          columnName: 'authGroupId',
          populate: 'auth.groups.get',
          async onRemove({ ctx, entity }: any) {
            await ctx.call('auth.groups.remove', { id: entity.authGroupId }, { meta: ctx?.meta });
          },
        },

        role: {
          virtual: true,
          type: 'string',
          populate(ctx: any, _values: any, tenants: any[]) {
            return Promise.all(
              tenants.map(async (tenant: any) => {
                if (!ctx.meta.user?.id) return;
                return ctx.call('tenantUsers.getRole', {
                  tenant: tenant.id,
                  user: ctx.meta.user.id,
                });
              }),
            );
          },
        },

        ...COMMON_FIELDS,
      },
    },
  };
}
