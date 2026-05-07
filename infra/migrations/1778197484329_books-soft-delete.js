/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("books", {
    deleted_at: {
      type: "timestamp with time zone",
      notNull: false,
      default: null,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("books", "deleted_at");
};
