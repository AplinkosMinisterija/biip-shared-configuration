import { Knex } from 'knex';
import { DatabaseMixin, DatabaseMixinOptions } from './database';
import { COMMON_FIELDS } from '../constants';

export enum UserType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export function UsersMixin(config: Knex.Config, opts?: DatabaseMixinOptions) {
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

        firstName: 'string',

        lastName: 'string',

        fullName: {
          type: 'string',
          virtual: true,
          get: ({ entity }: any) => `${entity.firstName} ${entity.lastName}`,
        },

        email: 'email',

        phone: {
          type: 'string',
          // TODO: validate
        },

        type: {
          type: 'string',
          enum: Object.values(UserType),
          default: UserType.USER,
        },

        authUser: {
          type: 'number',
          columnType: 'integer',
          columnName: 'authUserId',
          populate: 'auth.users.get',
          async onRemove({ ctx, entity }: any) {
            await ctx.call('auth.users.remove', { id: entity.authUserId }, { meta: ctx?.meta });
          },
        },

        role: {
          virtual: true,
          type: 'string',
          populate(ctx: any, _values: any, users: any[]) {
            return Promise.all(
              users.map(async (user: any) => {
                if (!ctx.meta.profile?.id) return;
                return ctx.call('tenantUsers.getRole', {
                  tenant: ctx.meta.profile.id,
                  user: user.id,
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
