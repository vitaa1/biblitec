/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'USER'`);
};

exports.down = () => {
  // valores de enum não podem ser removidos em Postgres sem recriar o tipo
};
