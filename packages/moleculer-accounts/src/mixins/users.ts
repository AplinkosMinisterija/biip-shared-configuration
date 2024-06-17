export const UsersMixin = {
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

      email: 'string',

      phone: 'string',

      authUser: {
        type: 'number',
        columnType: 'integer',
        columnName: 'authUserId',
        populate: 'auth.users.get',
        async onRemove({ ctx, entity }: any) {
          await ctx.call('auth.users.remove', { id: entity.authUserId }, { meta: ctx?.meta });
        },
      },
    },
  },
};
