'use strict';

import { Knex } from 'knex';
import _ from 'lodash';
import { Context } from 'moleculer';
// @ts-ignore
import { Service as DbService } from '@moleculer/database';
import { DeepQueryMixin } from './deepQuery';

function makeMapping(
  data: any[],
  mapping?: string,
  options?: {
    mappingMulti?: boolean;
    mappingField?: string;
  },
) {
  if (!mapping) return data;

  return data?.reduce((acc: any, item) => {
    let value: any = item;

    if (options?.mappingField) {
      value = item[options.mappingField];
    }

    if (options?.mappingMulti) {
      return {
        ...acc,
        [`${item[mapping]}`]: [...(acc[`${item[mapping]}`] || []), value],
      };
    }

    if (acc[item[mapping]]) {
      return acc;
    }

    return { ...acc, [`${item[mapping]}`]: value };
  }, {});
}

export type DatabaseMixinOptions = {
  collection: string;
  createActions?: boolean;
  cache?: { [key: string]: any };
  [key: string]: any;
};
export function DatabaseMixin(config: Knex.Config, opts: DatabaseMixinOptions) {
  const adapter: any = {
    type: 'Knex',
    options: {
      knex: config,
      tableName: opts.collection,
    },
  };

  const cache = {
    enabled: false,
  };

  opts = _.defaultsDeep(opts, { adapter }, { cache: opts.cache || cache });

  const removeRestActions: any = {};

  if (opts?.createActions === undefined || opts?.createActions !== false) {
    removeRestActions.replace = {
      rest: null as any,
    };
  }

  const schema: any = {
    mixins: [
      DeepQueryMixin(), // TODO: order matters, but it shouldn't! test it, I get errors in other order
      DbService(opts),
    ],

    actions: {
      ...removeRestActions,

      findOne(ctx: Context) {
        return this.findEntity(ctx);
      },

      async updateMany(ctx: Context<any[]>) {
        const updatedItems = await Promise.all(
          ctx.params.map(async (item: any) => await this.updateEntity(ctx, { ...item })),
        );

        return updatedItems;
      },

      async removeMany(ctx: Context) {
        return this.removeEntities(ctx);
      },

      async removeAllEntities(ctx: Context) {
        return this.clearEntities(ctx);
      },

      async populateByProp(
        ctx: Context<{
          id: number | number[];
          queryKey: string;
          query: any;
          mapping?: boolean;
          mappingMulti?: boolean;
          mappingField: string;
        }>,
      ): Promise<any> {
        const { queryKey, query, mapping, mappingMulti, mappingField } = ctx.params;

        const ids = Array.isArray(ctx.params.id) ? ctx.params.id : [ctx.params.id];

        delete ctx.params.queryKey;
        delete ctx.params.id;
        delete ctx.params.mapping;
        delete ctx.params.mappingMulti;
        delete ctx.params.mappingField;

        const entities = await this.findEntities(ctx, {
          ...ctx.params,
          query: {
            ...(query || {}),
            [queryKey]: { $in: ids },
          },
        });

        const resultById = makeMapping(entities, mapping ? queryKey : '', {
          mappingMulti,
          mappingField: mappingField,
        });

        return ids.reduce(
          (acc: any, id) => ({
            ...acc,
            [`${id}`]: resultById[id] || (mappingMulti ? [] : ''),
          }),
          {},
        );
      },
    },

    methods: {
      filterQueryIds(ids: number[], queryIds?: any) {
        if (!queryIds) return ids;

        queryIds = (Array.isArray(queryIds) ? queryIds : [queryIds]).map((id: any) => parseInt(id));

        return ids.filter((id) => queryIds.indexOf(id) >= 0);
      },
      async rawQuery(ctx: Context, sql: string) {
        const adapter = await this.getAdapter(ctx);
        const knex = adapter.client;
        const result = await knex.raw(sql);
        return result.rows;
      },
    },
    hooks: {
      after: {
        find: [
          async function (
            ctx: Context<{
              mapping: string;
              mappingMulti: boolean;
              mappingField: string;
            }>,
            data: any[],
          ) {
            const { mapping, mappingMulti, mappingField } = ctx.params;
            return makeMapping(data, mapping, {
              mappingMulti,
              mappingField,
            });
          },
        ],
      },
    },

    merged(schema: any) {
      if (schema.actions) {
        for (const action in schema.actions) {
          const params = schema.actions[action].additionalParams;
          if (typeof params === 'object') {
            schema.actions[action].params = {
              ...schema.actions[action].params,
              ...params,
            };
          }
        }
      }
    },

    async started() {
      // Seeding if the DB is empty
      const count = await this.countEntities(null, {
        scope: false,
      });

      if (count == 0 && _.isFunction(this.seedDB)) {
        this.logger.info(`Seed '${opts.collection}' collection...`);
        await this.seedDB();
      }
    },
  };

  return schema;
}
