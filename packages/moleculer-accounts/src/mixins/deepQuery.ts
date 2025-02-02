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
  leftJoinService: (serviceOrName: string | DeepService, column1: string, column2: string) => any;
};

export function DeepQueryMixin() {
  const schema = {
    methods: {
      // RECURSIVE!!!
      _joinField(params: DeepQuery) {
        const { fields, deeper, withQuery, serviceQuery, serviceFields, getService } = params;
        const field = fields.shift();
        const { service, handler } = this._getDeepConfigByField(field);

        handler(params);
        if (service) {
          deeper(service);
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

      _getDeepConfigByField(field: string) {
        let service: string, handler: (params: DeepQuery) => void;

        let config = this.settings.fields[field]?.deepQuery;

        switch (typeof config) {
          case 'string':
            service = config;
            break;

          case 'function':
            handler = config;
            break;

          case 'object':
            service = config.service;
            handler = config.handler;
            break;
        }

        if (!handler && service) {
          handler = ({ withQuery, serviceQuery, serviceFields, getService }) => {
            const subService = getService(service);
            const column = this.settings.fields[field]?.columnName || field;
            const subColumn = subService._getPrimaryKeyColumnName();

            const subQuery = serviceQuery(subService);
            subQuery.select(serviceFields(subService));
            withQuery(subQuery, column, subColumn);
          };
        }

        return {
          service,
          handler,
        };
      },

      _replaceQueryKey(key: string) {
        if (!key.includes('.')) {
          return key;
        }

        const field = key.split('.')[0];

        if (!this.settings.fields[field]?.deepQuery) {
          return key;
        }

        return key.replace(/\./g, '_');
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
          if (!params?.query) {
            return createQuery.call(adapter, params, opts);
          }

          const deepQueriedFields = new Set<string>();
          const query = params?.query ? Object.assign({}, params.query) : {};

          /**
           * All deep query fields will be repleaced "." => "_"
           * query[subColumn.field] => query[subColumn_field]
           */
          for (const [key, value] of Object.entries(query)) {
            const deepKey = this._replaceQueryKey(key);
            if (key !== deepKey) {
              const newKey = deepPrefix + '_' + deepKey;

              query[newKey] = value;
              delete query[key];

              const deepField = key.substring(0, key.lastIndexOf('.'));
              deepQueriedFields.add(deepField);
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
            const joinParms: Partial<DeepQuery> = {
              knex,
              q,
              tableName: snakeCase(this._getTableName()),
              subTableName: deepPrefix + '_' + snakeCase(fields[0]),
              field: fields[0],
              fields,
              depth: 0,
            };

            joinParms.withQuery = function (subQ: Knex, column1: string, column2: string) {
              q.with(joinParms.subTableName, subQ);
              q.leftJoin(joinParms.subTableName, function () {
                this.on(
                  `${joinParms.tableName}.${
                    joinParms.depth > 0 ? `${joinParms.tableName}_${column1}` : column1
                  }`,
                  '=',
                  `${joinParms.subTableName}.${joinParms.subTableName}_${column2}`,
                );
              });
            };

            joinParms.deeper = function (serviceOrName: string | any) {
              if (joinParms.fields.length) {
                const service = joinParms.getService(serviceOrName);

                joinParms.field = fields[0];
                joinParms.tableName = joinParms.subTableName;
                joinParms.subTableName = `${joinParms.subTableName}_${joinParms.fields[0]}`;
                joinParms.depth += 1;

                service._joinField(joinParms);
              }
            };

            joinParms.getService = (serviceOrName: string | any) => {
              return typeof serviceOrName === 'string'
                ? this.broker.getLocalService(serviceOrName)
                : serviceOrName;
            };

            joinParms.serviceFields = function (serviceOrName: string | any) {
              const service = joinParms.getService(serviceOrName);
              return service._getSelectFields(`${joinParms.subTableName}_`);
            };

            joinParms.serviceQuery = function (serviceOrName: string | any) {
              const service = joinParms.getService(serviceOrName);
              const q = service._getServiceQuery(joinParms.knex);
              q.select(joinParms.serviceFields(service));
              return q;
            };

            joinParms.leftJoinService = function (serviceOrName, column1, column2) {
              const subService = joinParms.getService(serviceOrName);
              const subQuery = joinParms.serviceQuery(subService);
              joinParms.withQuery(subQuery, column1, column2);

              // Continue recursion
              joinParms.deeper(subService);

              return subQuery;
            };
            this._joinField(joinParms);
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
