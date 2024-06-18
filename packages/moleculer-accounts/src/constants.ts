export enum RestrictionType {
  USER = 'USER',
  ADMIN = 'ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  TENANT_USER = 'TENANT_USER',
  PUBLIC = 'PUBLIC',
}

export const COMMON_SETTINGS_FIELDS = {
  createdBy: {
    type: 'string',
    readonly: true,
    onCreate: ({ ctx }: any) => ctx.meta.user?.id,
  },

  createdAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onCreate: () => new Date(),
  },

  updatedBy: {
    type: 'string',
    readonly: true,
    onUpdate: ({ ctx }: any) => ctx.meta.user?.id,
  },

  updatedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onUpdate: () => new Date(),
  },

  deletedBy: {
    type: 'string',
    readonly: true,
    hidden: 'byDefault',
    onRemove: ({ ctx }: any) => ctx.meta.user?.id,
  },

  deletedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onRemove: () => new Date(),
  },
};
