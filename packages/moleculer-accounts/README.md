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

The `DeepQuery` mixin is included by default with the `DatabaseMixin`. If you are using a `DatabaseMixin` other than `moleculer-accounts`, you can add it like this:

```js
export const YourService = {
  name: 'serviceName',
  mixins: [DeepQuery(), DatabaseMixin(knexConfig, options)],
};
```

**Note:** The `DeepQuery` mixin must be added **before** `DatabaseMixin`.

### Setup

To enable deep queries (similar to left joins), you need to add a `deepQuery` property to your database fields schema.

#### Automatic Deep Query

The easiest option is to specify the sub-service name in the `deepQuery` property. This will automatically join tables using the `id` and `subServiceId` columns.

```js
fields: {
  tenant: {
    type: 'number',
    columnName: 'tenantId',
    deepQuery: 'tenants',
  },
}
```

#### Manual Deep Query

Manual deep queries offer greater control but are more complex. We provide several helper functions to simplify writing these queries. Generally, you need to extend the predefined `q: Knex` query (usually with `with`) by defining sub-fields and joining them with the main query.

The most challenging part is prefixing all fields correctly. Here are some examples:

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

      // Continue recursion
      deeper(subService);
    },
  },

  lastHunting: {
    virtual: true,
    deepQuery({ knex, subTableName, tableName, q, deeper }: DeepQuery) {
      q.with(
        subTableName,
        knex.raw(`SELECT DISTINCT ON (hunting_area_id) hunting_area_id AS ${subTableName}_hunting_area, status AS ${subTableName}_status, created_by AS ${subTableName}_created_by
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

      // OPTIONAL: Continue recursion
      deeper('huntings');
    },
  }
}
```

### Usage

Using deep queries is straightforward and supports multiple levels.

```bash
# Single-level deep query
call huntings.find {"query":{"huntingArea.municipality":{$in:[33,72]}}}
call huntings.find {"query":{"huntingArea.municipality":72}}

# Multi-level deep query
call huntings.find {"query":{"huntingArea.createdBy.firstName":"Peter"}}

# Unlimited depth
call huntings.find {"query":{"huntingArea.createdBy.createdBy.firstName":"John"}}

# Combine manual and automatic deep queries
call huntingAreas.find {"query":{"lastHunting.createdBy.lastName":"Naudotojas"}}
```

### How It Works

Simple left joins are not possible with `DatabaseMixin` because it does not prefix fields with table names. To address this, the `DeepQuery` mixin generates sub-queries with prefixed column names. These prefixes are hidden from the end user, as shown in the examples.

Here is an example of the generated SQL:

```sql
WITH "hunting_area" AS (
  SELECT
    "id"              AS "hunting_area_id",
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
  FROM "hunting_areas"
  WHERE "deleted_at" IS NULL
)
SELECT *
FROM "huntings"
LEFT JOIN "hunting_area"
  ON "huntings"."hunting_area_id" = "hunting_area"."hunting_area_id"
WHERE ("deleted_at" IS NULL) AND "hunting_area_municipality" = 33;
```
