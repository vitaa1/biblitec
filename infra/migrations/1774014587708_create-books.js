/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("books", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    title: { type: "varchar(255)", notNull: true },
    author: { type: "varchar(255)", notNull: true },
    isbn: { type: "varchar(20)", notNull: true, unique: true },
    year: { type: "integer", notNull: true },
    quantity: { type: "integer", notNull: true, default: 1 },
    available_quantity: { type: "integer", notNull: true, default: 1 },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("books");
};
