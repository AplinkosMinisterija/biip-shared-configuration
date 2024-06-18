import { Knex } from 'knex';
import { commonFields } from './common';

export const UsersMigration = {
  up(table: Knex.TableBuilder) {
    table.increments('id');
    table.integer('userId').unsigned();
    table.integer('tenantId').unsigned();
    table.string('role', 255);
    commonFields.up(table);
  },
  down(table: Knex.TableBuilder) {
    table.dropColumn('id');
    table.dropColumn('userId');
    table.dropColumn('tenantId');
    table.dropColumn('role');
    commonFields.down(table);
  },
};
