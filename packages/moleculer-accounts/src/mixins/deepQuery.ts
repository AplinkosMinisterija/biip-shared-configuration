'use strict';

import { Knex } from 'knex';
import { snakeCase, wrap } from 'lodash';

type DeepService = {
  _joinField: any;
  getPrimaryKeyColumnName: any;
  _getSelectFields: any;
  _getServiceQuery: (knex: any) => Knex;
};

export type DeepQuery = {
  knex: any;
  q: Knex;
  tableName: string;
  subTableName: string;
  fields: string[];
  field: string;
  depth: number;
  deeper: any;
  withQuery: any;
  getService: (serviceOrName: string | DeepService) => DeepService;
  serviceFields: (serviceOrName: string | DeepService) => Record<string, string>;
  serviceQuery: (serviceOrName: string | DeepService) => Knex;
};

/**
Moleculer Database "fields" example 

      tenant: {
        type: 'number',
        columnType: 'integer',
        required: false,
        immutable: false,
        columnName: 'tenantId',
        populate: {
          action: 'tenants.resolve',
        },
        deepQuery: 'tenants',
      },

      tenant2: {
        type: 'number',
        columnType: 'integer',
        required: false,
        immutable: false,
        columnName: 'tenantId',
        populate: {
          action: 'tenants.resolve',
        },
        deepQuery({
          getService,
          field,
          serviceQuery,
          serviceFields,
          withQuery,
          deeper,
        }: DeepQuery) {
          const subService = getService('tenants');
          const column = this.settings.fields[field]?.columnName || field;
          const subColumn = subService.getIdColumnName();

          const subQuery = serviceQuery(subService);
          subQuery.select(serviceFields(subService));
          withQuery(subQuery, column, subColumn);

          // continue recursion
          deeper(subService);
        },
      },

      lastHuntingRaw: {
        virtual: true,
        deepQuery({ knex, subTableName, tableName, q, deeper }: DeepQuery) {
          q.with(
            subTableName,
            knex.raw(`SELECT DISTINCT ON (hunting_area_id) hunting_area_id as ${subTableName}_hunting_area, status as ${subTableName}_status, created_by as ${subTableName}_created_by
FROM huntings
WHERE deleted_at IS NULL
ORDER BY hunting_area_id, id DESC`)
          );

          q.leftJoin(subTableName, function () {
            this.on(
              `${tableName}.id`,
              '=',
              `${subTableName}.${subTableName}_hunting_area`
            );
          });

          // OPTIONAL: recursion
          deeper('huntings');
        },
      },

      lastHunting: {
        virtual: true,

        deepQuery({
          getService,
          serviceQuery,
          serviceFields,
          subTableName,
          withQuery,
          knex,
          deeper,
        }: DeepQuery) {
          const subService = getService('huntings');

          // Sukuria q:Knex, su FROM, ir deleted_at is null (jei soft-delete)
          const subQuery = serviceQuery(subService);

          // Grazina huntings serviso visus fieldus jau prefixintus { xxxxx_huntingArea: huntingAreaId, ....}
          const fieldsAll = serviceFields(subService);

          // Remove duplicate distinct field
          const fields = Object.fromEntries(
            Object.entries(fieldsAll).filter(
              ([_key, value]) => value !== 'huntingAreaId'
            )
          );

          subQuery.select(
            knex.raw(
              `DISTINCT ON (hunting_area_id) hunting_area_id as ${subTableName}_hunting_area`
            ),
            fields
          );

          subQuery
            .orderBy(`${subTableName}_hunting_area`) // Required for DISTINCT ON
            .orderBy('id', 'desc'); // Secondary ordering

          withQuery(subQuery, 'id', 'huntingArea');

          // Deeper
          deeper(subService);
        },
*/

export default function () {
  const schema = {
    methods: {
      // RECURSIVE!!!
      _joinField(params: DeepQuery) {
        const { fields, deeper, withQuery, serviceQuery, serviceFields, getService } = params;
        const field = fields.shift();
        const fieldSettings = this.settings.fields[field];

        switch (typeof fieldSettings.deepQuery) {
          case 'string':
            const subService = getService(fieldSettings.deepQuery);
            const column = this.settings.fields[field]?.columnName || field;
            const subColumn = subService.getPrimaryKeyColumnName();

            const subQuery = serviceQuery(subService);
            subQuery.select(serviceFields(subService));
            withQuery(subQuery, column, subColumn);

            // continue recursion
            deeper(subService);

            break;

          case 'function':
            fieldSettings.deepQuery(params);
            break;
        }
      },

      _getSelectFields(prefix: string) {
        const fields = Object.keys(this.settings.fields)
          .filter((field) => !this.settings.fields[field].virtual)
          .map((field) => ({
            field: field,
            column: this.settings.fields[field].columnName || field,
          }));

        return fields.reduce<Record<string, string>>((acc, curr) => {
          acc[`${prefix}${curr.field}`] = curr.column;
          return acc;
        }, {});
      },

      _getServiceQuery(knex: any) {
        const q: Knex = knex(this.getTableName());
        if (this.settings.fields.deletedAt) {
          q.whereNull(this.settings.fields.deletedAt.columnName || 'deletedAt');
        }
        return q;
      },
    },

    async started() {
      const adapter = await this.getAdapter();
      const knex = adapter.client;

      adapter.createQuery = wrap(
        adapter.createQuery,
        (createQuery, params: any, opts: any = {}) => {
          const deepQueriedFields = new Set<string>();
          const query = params?.query ? Object.assign({}, params.query) : {};

          /**
           * All deep query fields will be repleaced "." => "_"
           * query[subColumn.field] => query[subColumn_field]
           */
          for (const [key, value] of Object.entries(query)) {
            if (key.includes('.')) {
              const field = key.split('.')[0];

              if (this.settings.fields[field]?.deepQuery) {
                const newKey = key.replace(/\./g, '_');
                query[newKey] = value;
                delete query[key];

                const deepField = key.substring(0, key.lastIndexOf('.'));
                deepQueriedFields.add(deepField);
              }
            }
          }
          params.query = query;

          const q: Knex = createQuery.call(adapter, params, opts);

          for (const fieldString of deepQueriedFields) {
            const fields = fieldString.split('.');
            const params: Partial<DeepQuery> = {
              knex,
              q,
              tableName: snakeCase(this.getTableName()),
              subTableName: snakeCase(fields[0]),
              field: fields[0],
              fields,
              depth: 0,
            };

            params.withQuery = function (subQ: Knex, column1: string, column2: string) {
              q.with(params.subTableName, subQ);
              q.leftJoin(params.subTableName, function () {
                this.on(
                  `${params.tableName}.${
                    params.depth > 0 ? `${params.tableName}_${column1}` : column1
                  }`,
                  '=',
                  `${params.subTableName}.${params.subTableName}_${column2}`,
                );
              });
            };

            params.deeper = function (serviceOrName: string | any) {
              if (params.fields.length) {
                const service = params.getService(serviceOrName);

                params.field = fields[0];
                params.tableName = params.subTableName;
                params.subTableName = `${params.subTableName}_${params.fields[0]}`;
                params.depth += 1;

                service._joinField(params);
              }
            };

            params.getService = (serviceOrName: string | any) => {
              return typeof serviceOrName === 'string'
                ? this.broker.getLocalService(serviceOrName)
                : serviceOrName;
            };

            params.serviceFields = function (serviceOrName: string | any) {
              const service = params.getService(serviceOrName);
              return service._getSelectFields(`${params.subTableName}_`);
            };

            params.serviceQuery = function (serviceOrName: string | any) {
              const service = params.getService(serviceOrName);
              return service._getServiceQuery(params.knex);
            };

            this._joinField(params);
          }

          return q;
        },
      );
    },
  };

  return schema;
}
