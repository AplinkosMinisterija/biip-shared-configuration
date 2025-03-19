'use strict';

import { Knex } from 'knex';
import { isObject, snakeCase, wrap } from 'lodash';

// @ts-ignore
import mToPsql from 'mongo-query-to-postgres-jsonb';

type rawStatementSanitized = { condition: string; bindings?: unknown[] };
type rawStatement = string | rawStatementSanitized;

function sanitizeRaw(statement: rawStatement): rawStatementSanitized {
  return {
    condition: typeof statement === 'string' ? statement : statement.condition,
    bindings: typeof statement === 'string' ? [] : statement.bindings || [],
  };
}

export function mergeRaw(extend: rawStatement, base?: rawStatement): rawStatement {
  if (!base) {
    return extend;
  }

  base = sanitizeRaw(base);
  extend = sanitizeRaw(extend);

  return {
    condition: `(${base.condition}) AND (${extend.condition})`,
    bindings: [...base.bindings, ...extend.bindings],
  };
}

export type DeepService = {
  _joinField: any;
  _getPrimaryKeyColumnName: any;
  _getSelectFields: any;
  _getServiceQuery: (knex: any) => Knex;
  _columnName: (field: string) => string;
};

export type DeepQuery = {
  knex: any;
  q: Knex;
  tableName: string;
  subTableName: string;
  fields: string[];
  field: string;
  depth: number;
  withQuery: (subQ: Knex, column1: string, column2: string) => void;
  getService: (serviceOrName: string | DeepService) => DeepService;
  serviceFields: (serviceOrName: string | DeepService) => Record<string, string>;
  serviceQuery: (serviceOrName: string | DeepService) => any;
  leftJoinService: (serviceOrName: string | DeepService, column1: string, column2: string) => any;
};

export function DeepQueryMixin() {
  const schema = {
    methods: {
      // RECURSIVE!!!
      _joinField(joinParms: DeepQuery) {
        const { fields } = joinParms;
        const field = fields.shift();
        let { service, handler } = this._getDeepConfigByField(field);

        if (handler) {
          handler(joinParms);
        }

        if (service && fields.length) {
          joinParms.field = fields[0];
          joinParms.tableName = joinParms.subTableName;
          joinParms.subTableName = `${joinParms.subTableName}_${service._columnName(
            joinParms.fields[0],
          )}`;
          joinParms.depth += 1;

          service._joinField(joinParms);
        }
      },

      _getSelectFields(prefix: string) {
        const fields = Object.keys(this.settings.fields)
          .filter((field) => !this.settings.fields[field].virtual)
          .map((field) => this.settings.fields[field].columnName || field);

        return fields.reduce<Record<string, string>>((acc, column) => {
          acc[`${prefix}${column}`] = column;
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
        const fields = this.settings.fields;

        for (const key in fields) {
          if (fields[key].primaryKey) {
            return fields[key].columnName || key;
          }
        }

        const key = Object.keys(fields)[0];
        return fields[key].columnName || key;
      },

      _isFieldDeep(field: string) {
        return !!this.settings.fields[field]?.deepQuery;
      },

      _getDeepConfigByField(field: string) {
        let service: string | any, handler: (params: DeepQuery) => void;

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

        if (typeof service === 'string') {
          service = this.broker.getLocalService(service);
        }

        if (!handler && service) {
          handler = ({ leftJoinService, getService }) => {
            const subService = getService(service);
            const column = this.settings.fields[field]?.columnName || field;
            const subColumn = subService._getPrimaryKeyColumnName();

            leftJoinService(subService, column, subColumn);
          };
        }

        return {
          service,
          handler,
        };
      },

      _columnName(field: string) {
        const config = this.settings.fields[field];
        return config?.columnName || field;
      },

      _replaceQueryKey(key: string) {
        if (!key.includes('.')) {
          return [this._columnName(key), this.settings.fields[key]];
        }

        const [field, ...restOfKeyParts] = key.split('.');
        if (!this._isFieldDeep(field)) {
          return [key, this.settings.fields[field]];
        }

        const { service } = this._getDeepConfigByField(field);
        let restKey = restOfKeyParts.join('.');
        let config = this.settings.fields[key];

        if (service?._replaceQueryKey) {
          [restKey, config] = service._replaceQueryKey(restKey);
        }

        return [`${this._columnName(field)}_${restKey}`, config];
      },

      // JSONB
      _schemaArrayFields(fieldSchema: any, parents: string[] = []) {
        const arrayFields: string[] = [];

        if (!fieldSchema) {
          return arrayFields;
        }

        const fieldType = typeof fieldSchema === 'string' ? fieldSchema : fieldSchema.type;

        switch (fieldType) {
          case 'object': {
            const properties = fieldSchema?.props || fieldSchema?.properties || {};

            for (const key in properties) {
              const subFieldSchema = properties?.[key];
              const subParents = [...parents, key];
              const subArrayFields = this._schemaArrayFields(subFieldSchema, subParents);

              arrayFields.push(...subArrayFields);
            }

            break;
          }

          case 'array': {
            arrayFields.push(parents.join('.'));
          }
        }

        return arrayFields;
      },

      _parseSort(
        sort: string[],
        deepPrefix: string,
        deepQueriedFields: Set<string>,
        jsonSortFields: Set<{ field: string; desc: boolean; config: any }>,
      ) {
        const parsedSort = sort.map((item) => {
          const desc = item.startsWith('-'); // Check if it starts with '-'
          const field = desc ? item.slice(1) : item; // Remove '-' if present
          return { field, desc };
        });

        let jsonSort = false;

        for (const key in parsedSort) {
          const { field, desc } = parsedSort[key];
          let [newField, config] = this._replaceQueryKey(field);

          if (field !== newField) {
            newField = deepPrefix + '_' + newField;

            sort[key] = desc ? '-' + newField : newField;

            const deepField = field.substring(0, field.lastIndexOf('.'));
            deepQueriedFields.add(deepField);
          }

          jsonSortFields.add({ field: newField, desc, config });

          if (newField.includes('.')) {
            jsonSort = true;
          }
        }

        if (jsonSort) {
          sort.splice(0, sort.length);
        }

        console.log(sort, jsonSort, jsonSortFields);
      },

      _parseQuery(query: any, deepPrefix: string, deepQueriedFields: Set<string>) {
        for (const [key, value] of Object.entries(query)) {
          if (['$and', '$or', '$nor'].includes(key) && Array.isArray(value)) {
            for (const q of value) {
              this._parseQuery(q, deepPrefix, deepQueriedFields);
            }

            continue;
          }

          let [newKey, fieldConfig] = this._replaceQueryKey(key);

          if (key !== newKey) {
            newKey = deepPrefix + '_' + newKey;

            query[newKey] = value;
            delete query[key];

            const deepField = key.substring(0, key.lastIndexOf('.'));
            deepQueriedFields.add(deepField);
          }

          // JSON query
          if (['array', 'object'].includes(fieldConfig?.type) && isObject(value)) {
            delete query[newKey];

            const snakeCaseFieldKey = snakeCase(newKey);
            let condition: string = '';
            switch (fieldConfig.type) {
              case 'array':
                const subCondition = mToPsql(
                  `${snakeCaseFieldKey}_elem`,
                  value,
                  this._schemaArrayFields(fieldConfig?.items),
                );
                condition = `EXISTS (
    SELECT 1
    FROM jsonb_array_elements(${snakeCaseFieldKey}) AS ${snakeCaseFieldKey}_elem
    WHERE ${subCondition}
)`;
                break;

              case 'object':
                condition = mToPsql(snakeCaseFieldKey, value, this._schemaArrayFields(fieldConfig));
                break;
            }

            query.$raw = mergeRaw(
              {
                condition,
                bindings: [],
              },
              query?.$raw,
            );
          }
        }
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

          params.sort = params?.sort ? [...params.sort] : [];
          params.query = params?.query ? Object.assign({}, params.query) : {};

          const deepQueriedFields = new Set<string>();
          const jsonSortFields = new Set<{ field: string; desc: boolean; config: any }>();

          this._parseSort(params.sort, deepPrefix, deepQueriedFields, jsonSortFields);
          this._parseQuery(params.query, deepPrefix, deepQueriedFields);

          const qRoot: any = createQuery.call(adapter, params, opts);

          if (deepQueriedFields.size === 0 && jsonSortFields.size === 0) {
            return qRoot;
          }

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
              subTableName: deepPrefix + '_' + snakeCase(this._columnName(fields[0])),
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

              return subQuery;
            };

            this._joinField(joinParms);
          }

          if (!opts.counting && jsonSortFields.size > 0) {
            for (const { field, desc, config } of jsonSortFields) {
              let fieldSchema = config;

              const column = field
                .split('.')
                .map((field, index, fields) => {
                  if (index === 0) {
                    return field;
                  }

                  const properties = fieldSchema?.props || fieldSchema?.properties || {};
                  fieldSchema = properties?.[field];

                  field = `'${field}'`;

                  if (index === fields.length - 1) {
                    const fieldType =
                      typeof fieldSchema === 'string' ? fieldSchema : fieldSchema?.type || 'string';
                    if (fieldType !== 'number') {
                      field = `>${field}`;
                    }
                  }

                  return field;
                })
                .join('->');

              qRoot.orderByRaw(`${column} ${desc ? 'DESC' : 'ASC'}`);
            }
          }

          const idField = this._getPrimaryKeyColumnName();
          q.distinctOn(idField).orderBy(idField, 'asc');

          return qRoot;
        },
      );
    },
  };

  return schema;
}
