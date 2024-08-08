'use strict';

import { Context, GenericObject } from 'moleculer';
import PostgisMixin from 'moleculer-postgis';
import { DatabaseMixinOptions, DatabaseMixin } from './database';
import Supercluster from 'supercluster';
// @ts-ignore
import vtpbf from 'vt-pbf';
import _ from 'lodash';
import { Knex } from 'knex';
import { parseToJsonIfNeeded } from '../utils';
import { throwNotFoundError } from '../constants';

const superclusterOpts = {
  radius: 64,
  extent: 512,
  generateId: true,
  reduce: (acc: any, props: any) => acc,
};

const WGS_SRID = 4326;
const LKS_SRID = 3346;
const WM_SRID = 3857;

function getSuperclusterHash(query: any = {}) {
  if (typeof query !== 'string') {
    query = JSON.stringify(query);
  }
  return query || 'default';
}

export function TilesMixin(opts: {
  config: Knex.Config;
  opts: DatabaseMixinOptions;
  maxClusteringZoomLevel?: number;
  srid?: number; // Defaults to LKS
  layerName?: string; // Cluster layer name
  geomFieldName?: string; // Geom field name
  preloadClustersOnStart?: boolean; // Preload initial cluster
}) {
  const maxClusteringZoomLevel = opts.maxClusteringZoomLevel || 12;
  const layerName = opts.layerName || 'features';
  const geomField = opts.geomFieldName || 'geom';
  const srid = opts.srid || LKS_SRID;

  const schema: any = {
    mixins: [
      DatabaseMixin(
        opts.config,
        _.merge({}, opts.opts, {
          createActions: {
            create: false,
            update: false,
            createMany: false,
            remove: false,
          },
        }),
      ),
      PostgisMixin({
        srid: WGS_SRID,
        geojson: {
          maxDecimalDigits: 5,
        },
      }),
    ],
    actions: {
      getTile: {
        params: {
          x: 'number|convert|min:0|integer',
          z: 'number|convert|min:0|integer',
          y: 'number|convert|min:0|integer',
          query: ['object|optional', 'string|optional'],
        },
        rest: 'GET /:z/:x/:y',
        async handler(
          ctx: Context<
            { x: number; y: number; z: number; query?: string | GenericObject },
            { $responseHeaders: any; $responseType: string }
          >,
        ) {
          const { x, y, z } = ctx.params;

          ctx.params.query = parseToJsonIfNeeded(ctx.params.query);
          ctx.meta.$responseType = 'application/x-protobuf';

          // make clusters
          if (z <= maxClusteringZoomLevel) {
            const supercluster: Supercluster = await this.getSupercluster(ctx);

            const tileObjects = supercluster.getTile(z, x, y);

            const layers: any = {};

            if (tileObjects) {
              layers[layerName] = tileObjects;
            }

            return Buffer.from(
              vtpbf.fromGeojsonVt(layers, { extent: superclusterOpts.extent, version: 2 }),
            );
          }

          // show real geometries
          const tileData = await this.getMVTTiles(ctx);
          return tileData.tile;
        },
      },
      getEventsFeatureCollection: {
        timeout: 0,
        async handler(ctx: Context<{ query: any }>) {
          const adapter = await this.getAdapter(ctx);
          const table = adapter.getTable();
          const knex = adapter.client;

          const query = await this.getComputedQuery(ctx);
          const fields = ['id'];

          const itemsQuery = adapter
            .computeQuery(table, query)
            .select(
              ...fields,
              knex.raw(
                `ST_Transform(ST_PointOnSurface(${geomField}), ${WGS_SRID}) as ${geomField}`,
              ),
            );

          const res = await knex
            .select(knex.raw(`ST_AsGeoJSON(i)::json as feature`))
            .from(itemsQuery.as('i'));

          return {
            type: 'FeatureCollection',
            features: res.map((i: any) => i.feature),
          };
        },
      },
      getTileItems: {
        rest: 'GET /cluster/:cluster/items',
        params: {
          cluster: 'number|convert|positive|integer',
          page: 'number|convert|positive|integer|optional',
          pageSize: 'number|convert|positive|integer|optional',
        },
        async handler(
          ctx: Context<
            {
              cluster: number;
              query: string | GenericObject;
              page?: number;
              pageSize?: number;
              populate?: string | string[];
              sort?: string | string[];
            },
            { $responseHeaders: any; $responseType: string }
          >,
        ) {
          const { cluster } = ctx.params;
          const page = ctx.params.page || 1;
          const pageSize = ctx.params.pageSize || 10;
          const { sort, populate } = ctx.params;
          const supercluster: Supercluster = await this.getSupercluster(ctx);

          if (!supercluster) throwNotFoundError('No items!');

          const ids = supercluster.getLeaves(cluster, Infinity).map((i) => i.properties.id);

          if (!ids?.length) {
            return {
              rows: [],
              total: 0,
              page,
              pageSize,
              totalPages: 0,
            };
          }

          return ctx.call(`${this.name}.list`, {
            query: {
              // knex support for `$in` is limited to 30K or smth
              $raw: `id IN ('${ids.join("', '")}')`,
            },
            populate,
            page,
            pageSize,
            sort,
          });
        },
      },
    },
    events: {
      async '$broker.started'() {
        this.superclusters = {};
        this.superclustersPromises = {};
        // This takes time
        if (opts?.preloadClustersOnStart) {
          try {
            await this.renewSuperclusterIndex();
          } catch (err) {
            console.error('Cannot create super clusters', err);
          }
        }
      },
    },

    started() {
      this.superclusters = {};
      this.superclustersPromises = {};
    },

    methods: {
      async getMVTTiles(ctx: Context<{ query: any; x: number; y: number; z: number }>) {
        const adapter = await this.getAdapter(ctx);
        const table = adapter.getTable();
        const knex: Knex = adapter.client;

        const query = await this.getComputedQuery(ctx);

        const fields = ['id'];
        const { x, y, z } = ctx.params;

        const envelopeQuery = `ST_TileEnvelope(${z}, ${x}, ${y})`;
        const transformedEnvelopeQuery = `ST_Transform(${envelopeQuery}, ${srid})`;
        const transformedGeomQuery = `ST_Transform(ST_CurveToLine("${geomField}"), ${WM_SRID})`;

        const asMvtGeomQuery = adapter
          .computeQuery(table, query)
          .whereRaw(`ST_Intersects(${geomField}, ${transformedEnvelopeQuery})`)
          .select(
            ...fields,
            knex.raw(
              `ST_AsMVTGeom(${transformedGeomQuery}, ${envelopeQuery}, 4096, 64, true) AS ${geomField}`,
            ),
          );

        const tileQuery = knex
          .select(knex.raw(`ST_AsMVT(tile, '${layerName}', 4096, '${geomField}') as tile`))
          .from(asMvtGeomQuery.as('tile'))
          .whereNotNull(geomField);

        return tileQuery.first();
      },

      async getComputedQuery(ctx: Context<{ query: any }>) {
        let { params } = ctx;
        params = this.sanitizeParams(params);
        params = await this._applyScopes(params, ctx);
        params = this.paramsFieldNameConversion(params);

        return parseToJsonIfNeeded(params.query) || {};
      },

      async getSupercluster(ctx: Context<{ query: any }>) {
        const hash = getSuperclusterHash(ctx.params.query);

        if (!this.superclusters?.[hash]) {
          await this.renewSuperclusterIndex(ctx.params.query);
        }

        return this.superclusters[hash];
      },

      async renewSuperclusterIndex(query: any = {}) {
        // TODO: apply to all superclusters (if exists)
        const hash = getSuperclusterHash(query);

        const supercluster = new Supercluster(superclusterOpts);

        // Singleton!
        if (this.superclustersPromises[hash]) {
          return this.superclustersPromises[hash];
        }

        this.superclustersPromises[hash] = this.actions.getEventsFeatureCollection({ query });
        const featureCollection: any = await this.superclustersPromises[hash];

        supercluster.load(featureCollection.features || []);
        this.superclusters[hash] = supercluster;

        delete this.superclustersPromises[hash];
      },
    },
  };

  return schema;
}
