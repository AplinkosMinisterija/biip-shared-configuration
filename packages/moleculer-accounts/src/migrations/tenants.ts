import { Knex } from 'knex';
import { commonFields } from './common';

export const TenantsMigration = {
  up(table: Knex.TableBuilder) {
    table.increments('id');
    table.string('name', 255);
    table.string('email', 255);
    table.string('phone', 255);
    table.integer('authGroupId').unsigned();
    commonFields.up(table);
  },
  down(table: Knex.TableBuilder) {
    table.dropColumn('id');
    table.dropColumn('name');
    table.dropColumn('email');
    table.dropColumn('phone');
    table.dropColumn('authGroupId');
    commonFields.down(table);
  },
};
