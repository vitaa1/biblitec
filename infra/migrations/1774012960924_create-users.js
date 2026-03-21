/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension("uuid-ossp", { ifNotExists: true });

  pgm.createType("user_role", ["ADMIN", "MEMBER"]);

  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    email: { type: "varchar(255)", notNull: true, unique: true },
    password: { type: "varchar(255)", notNull: true },
    name: { type: "varchar(255)", notNull: true },
    role: { type: "user_role", notNull: true, default: "MEMBER" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
};

exports.down = (pgm) => {
  (pgm.dropTable("users"), pgm.dropType("user_role"));
};
