import { Knex } from 'knex';
import { commonFields } from './common';

export const UsersMigration = {
  up(table: Knex.TableBuilder) {
    table.increments('id');
    table.string('firstName', 255);
    table.string('lastName', 255);
    table.string('email', 255);
    table.string('phone', 255);
    table.integer('authUserId').unsigned();
    commonFields.up(table);
  },
  down(table: Knex.TableBuilder) {
    table.dropColumn('id');
    table.dropColumn('firstName');
    table.dropColumn('lastName');
    table.dropColumn('email');
    table.dropColumn('phone');
    table.dropColumn('authUserId');
    commonFields.down(table);
  },
};
