import { Knex } from 'knex';
import { DatabaseMixin, DatabaseMixinOptions } from './database';
import { COMMON_SETTINGS_FIELDS } from '../constants';

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

        ...COMMON_SETTINGS_FIELDS,
      },
    },
  };
}
