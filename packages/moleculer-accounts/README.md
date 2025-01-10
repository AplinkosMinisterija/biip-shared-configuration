# BĮIP Moleculer Accounts

## Usage

1. **Install the Package**

   To get started, you need to install the `@aplinkosministerija/moleculer-accounts` package. You can do this using `yarn` or `npm`:

   ```bash
   yarn add @aplinkosministerija/moleculer-accounts
   npm install @aplinkosministerija/moleculer-accounts
   ```

2. **Use in action**

   ```js
   import { DatabaseMixin } from '@aplinkosministerija/moleculer-accounts';

   export const YourService = {
     name: 'serviceName',
     mixins: [DatabaseMixin(knexConfig, options)],
   };
   ```

## Deep Query Mixin

Mixin comes by default with `database` mixin. If you are using `DatabaseMixin` other than `moleculer-accounts`, you can add it like that:

```js
export const YourService = {
  name: 'serviceName',
  mixins: [DeepQuery(), DatabaseMixin(knexConfig, options)],
};
```

Be aware - it should go BEFORE `DatabaseMixin`.

### Setup

To be able to use deep queries (left-join-like), you need to add `deepQuery` property to your database fields schema.

#### Automatic deep query

Easiest option is to specify sub-service name in `deepQuery` property. It will automatically join tables by `id` and `subServiceId` columns.

```js
fields: {
  tenant: {
    type: 'number',
    columnName: 'tenantId',
    deepQuery: 'tenants',
  },
}
```

#### Manual deep query

Manual deep query is more tricky, but gives you more control over the query.
We provide many helper functions to make it easier to write deep queries.
Basically you have to extend predefined `q: Knex` query usually with `with` by providing sub-fields and join it with main query.
Trickiest part is to prefix all the fields, here are some examples:

```js
fields: {
  tenant: {
    type: 'number',
    columnType: 'integer',
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

  lastHunting: {
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
  }
}
```

### Usage

Querying with deep query is as simple and powerful, with multi-level support.

```bash
# 1 level deep query
call huntings.find {"query":{"huntingArea.municipality":{$in:[33,72]}}}
call huntings.find {"query":{"huntingArea.municipality":72}}

# multi-level
call huntings.find {"query":{"huntingArea.createdBy.firstName":"Peter"}}

# you can go as deep as you want
call huntings.find {"query":{"huntingArea.createdBy.createdBy.firstName":"John"}}

# you can go in deep from "manual" to "automatic" and vice versa
call huntingAreas.find {"query":{"lastHunting.createdBy.lastName":"Naudotojas"}}
```

### How it works

Simple left-joins are not possible with `DatabaseMixin` as it does not prefix fields with table names. To overcome this, this mixin creates sub-queries with prefixed column names. Prefixes are hided from end user, as you saw from examples.

This is example generated SQL

```sql
WITH "hunting_area"
     AS (SELECT "id"              AS "hunting_area_id",
                "name"            AS "hunting_area_name",
                "display_name"    AS "hunting_area_display_name",
                "mpv_id"          AS "hunting_area_mpv_id",
                "municipality_id" AS "hunting_area_municipality",
                "tenant_id"       AS "hunting_area_tenant",
                "created_by"      AS "hunting_area_created_by",
                "created_at"      AS "hunting_area_created_at",
                "updated_by"      AS "hunting_area_updated_by",
                "updated_at"      AS "hunting_area_updated_at",
                "deleted_by"      AS "hunting_area_deleted_by",
                "deleted_at"      AS "hunting_area_deleted_at"
         FROM   "hunting_areas"
         WHERE  "deleted_at" IS NULL)
SELECT *
FROM   "huntings"
       LEFT JOIN "hunting_area"
              ON "huntings"."hunting_area_id" = "hunting_area"."hunting_area_id"
WHERE  ( "deleted_at" IS NULL )
       AND "hunting_area_municipality" = 33
```
