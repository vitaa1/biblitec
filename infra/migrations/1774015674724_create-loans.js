/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType("loans_status", ["ACTIVE", "RETURNED", "OVERDUE"]);

  pgm.createTable("loans", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    student_id: {
      type: "uuid",
      notNull: true,
      reference: "students(id)",
      onDelete: "CASCADE",
    },
    created_by_user_id: {
      type: "uuid",
      notNull: true,
      reference: "users(id)",
      onDelete: "CASCADE",
    },
    book_id: {
      type: "uuid",
      notNull: true,
      reference: "books(id)",
      onDelete: "CASCADE",
    },
    loaned_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    due_date: { type: "timestamptz", notNull: true },
    returned_at: { type: "timestamptz" },
    status: { type: "loans_status", notNull: true, default: "ACTIVE" },
  });

  pgm.createIndex("loans", "student_id");
  pgm.createIndex("loans", "created_by_user_id");
  pgm.createIndex("loans", "book_id");
};

exports.down = (pgm) => {
  pgm.dropTable("loans");
  pgm.dropType("loans_status");
};
