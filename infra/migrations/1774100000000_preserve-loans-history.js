/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE loans
    DROP CONSTRAINT IF EXISTS loans_student_id_fkey,
    DROP CONSTRAINT IF EXISTS loans_created_by_user_id_fkey,
    DROP CONSTRAINT IF EXISTS loans_book_id_fkey;
  `);

  pgm.sql(`
    ALTER TABLE loans
    ADD CONSTRAINT loans_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
    ADD CONSTRAINT loans_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT loans_book_id_fkey
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE loans
    DROP CONSTRAINT IF EXISTS loans_student_id_fkey,
    DROP CONSTRAINT IF EXISTS loans_created_by_user_id_fkey,
    DROP CONSTRAINT IF EXISTS loans_book_id_fkey;
  `);

  pgm.sql(`
    ALTER TABLE loans
    ADD CONSTRAINT loans_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    ADD CONSTRAINT loans_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT loans_book_id_fkey
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
  `);
};
