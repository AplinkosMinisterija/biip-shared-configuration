'use strict';

import { Knex } from 'knex';
import { snakeCase, wrap } from 'lodash';

export type DeepService = {
  _joinField: any;
  _getPrimaryKeyColumnName: any;
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
  serviceQuery: (serviceOrName: string | DeepService) => any;
};

export function DeepQueryMixin() {
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
            const subColumn = subService._getPrimaryKeyColumnName();

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
        const q: Knex = knex(this._getTableName());
        if (this.settings.fields.deletedAt) {
          q.whereNull(this.settings.fields.deletedAt.columnName || 'deletedAt');
        }
        return q;
      },

      _getTableName() {
        return this.settings.tableName;
      },

      _getPrimaryKeyColumnName() {
        // TODO: filter this.settings.fields by primaryKey: true; return key or columnName
        return 'id';
      },
    },

    async started() {
      const adapter = await this.getAdapter();
      const knex = adapter.client;
      this.settings.tableName = adapter.opts.tableName;

      const deepPrefix = 'deep_query'; // TODO: allow mixin config? or calculate from table column names

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
                const newKey = deepPrefix + '_' + key.replace(/\./g, '_');
                query[newKey] = value;
                delete query[key];

                const deepField = key.substring(0, key.lastIndexOf('.'));
                deepQueriedFields.add(deepField);
              }
            }
          }
          params.query = query;

          const qRoot: any = createQuery.call(adapter, params, opts);
          const q: any = qRoot.clone();
          qRoot.from(q.as('qDeep'));

          const KNEX_PRESENT_LAYER = ['select', 'columns', 'order', 'limit', 'offset'];

          const KNEX_DATA_LAYER = [
            'with',
            'where',
            'union',
            'join',
            'group',
            'having',
            'counter',
            'counters',
          ];

          KNEX_PRESENT_LAYER.forEach((key: any) => q.clear(key));
          KNEX_DATA_LAYER.forEach((key: any) => qRoot.clear(key));

          for (const fieldString of deepQueriedFields) {
            const fields = fieldString.split('.');
            const params: Partial<DeepQuery> = {
              knex,
              q,
              tableName: snakeCase(this._getTableName()),
              subTableName: deepPrefix + '_' + snakeCase(fields[0]),
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
              const q = service._getServiceQuery(params.knex);
              q.select(params.serviceFields(service));
              return q;
            };

            this._joinField(params);
          }
          q.distinctOn('id').orderBy('id', 'asc');

          console.log(qRoot.toString());
          return qRoot;
        },
      );
    },
  };

  return schema;
}
