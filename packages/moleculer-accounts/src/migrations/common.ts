import type { Knex } from 'knex';
export const commonFields = {
  up(table: Knex.TableBuilder) {
    table.timestamp('createdAt');
    table.integer('createdBy').unsigned();
    table.timestamp('updatedAt');
    table.integer('updatedBy').unsigned();
    table.timestamp('deletedAt');
    table.integer('deletedBy').unsigned();
  },
  down(table: Knex.TableBuilder) {
    table.dropColumn('createdAt');
    table.dropColumn('createdBy');
    table.dropColumn('updatedAt');
    table.dropColumn('updatedBy');
    table.dropColumn('deletedAt');
    table.dropColumn('deletedBy');
  },
};
