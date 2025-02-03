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

The easiest option is to specify the sub-service name in the `deepQuery` property. This will automatically join tables using the `<fieldName>` and `subService.<id>` columns.

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
  // one to one
  tenant: {
    type: 'number',
    columnType: 'integer',
    deepQuery: {
      // Optional: providing service name continues recursion deeper
      service: 'tenants',
      handler({ leftJoinService }: DeepQuery) {
        leftJoinService('tenants', 'tenant', 'id');
      },
    },
  },

  // one to many
  huntings: {
    virtual: true,
    deepQuery: {
      service: 'huntings',
      handler({ leftJoinService }: DeepQuery) {
        leftJoinService('huntings', 'id', 'huntingAreaId');
      },
    },
  },

  // one to one "custom" select (could be done easier with helpers like `withQuery` and others)
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

### Querying `jsonb` fields

`DeepQuery` mixin supports querying `jsonb` fields. Field must have `object` or `array` type. Deeper structure description is optional except for cases with arrays - mixin needs to know which properties are array type (in any depth). Querying is done by providing object - imagine `jsonb` field as MongoDB document, and query values as MongoDB query.

#### Examples

```js
fields: {
  address: {
    type: 'object',
    // properties are OPTIONAL for this functionality in this case, no arrays in any depth
    properties: {
      street: 'string',
      city: 'string',
      phone: {
        type: 'object',
        properties: {
          number: 'string',
          countryCode: 'string',
        },
      }
    },
  },
}
```

```bash
call users.find {"query":{"address":{"city":"Vilnius"}}}

# deeper query
call users.find {"query":{"address":{"phone.countryCode":"+370"}}}

# mongodb operators
call users.find {"query":{"address":{"phone.countryCode":{"$in":["+370","+371"]}}}}

# deepQuery first - jsonb next
call tenants.find {"query":{"craetedBy.address":{"phone.countryCode":{"$in":["+370","+371"]}}}}
```

#### Array

As said earlier, deeper structure description is required for arrays. This is because the mixin needs to know which properties are array type (in any depth).

````js
fields: {
  address: {
    type: 'object',
    // properties are REQUIRED this time, if you want to be able to query by array fields (and deeper)
    properties: {
//      street: 'string', // <-- not required, not array
 //     city: 'string',
      phoneNumbers: {
        type: 'array',
      }
    },
  },
}
```js
````
