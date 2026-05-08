import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const papelUsuarioEnum = pgEnum("papel_usuario", ["ADMIN", "USER"]);
export const statusEmprestimoEnum = pgEnum("status_emprestimo", [
  "ACTIVE",
  "RETURNED",
  "OVERDUE",
]);

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  senha: varchar("senha", { length: 255 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  papel: papelUsuarioEnum("papel").notNull().default("ADMIN"),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const livros = pgTable("livros", {
  id: uuid("id").primaryKey().defaultRandom(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  autor: varchar("autor", { length: 255 }).notNull(),
  isbn: varchar("isbn", { length: 20 }).notNull().unique(),
  ano: integer("ano"),
  quantidade: integer("quantidade").notNull().default(1),
  quantidadeDisponivel: integer("quantidade_disponivel").notNull().default(1),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletadoEm: timestamp("deletado_em", { withTimezone: true }),
});

export const leitores = pgTable("leitores", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  matricula: varchar("matricula", { length: 50 }).notNull().unique(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emprestimos = pgTable(
  "emprestimos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leitorId: uuid("leitor_id")
      .notNull()
      .references(() => leitores.id, { onDelete: "restrict" }),
    criadoPorUsuarioId: uuid("criado_por_usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    livroId: uuid("livro_id")
      .notNull()
      .references(() => livros.id, { onDelete: "restrict" }),
    emprestadoEm: timestamp("emprestado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dataDevolucao: timestamp("data_devolucao", {
      withTimezone: true,
    }).notNull(),
    devolvidoEm: timestamp("devolvido_em", { withTimezone: true }),
    status: statusEmprestimoEnum("status").notNull().default("ACTIVE"),
  },
  (table) => [
    index("emprestimos_leitor_id_idx").on(table.leitorId),
    index("emprestimos_criado_por_usuario_id_idx").on(table.criadoPorUsuarioId),
    index("emprestimos_livro_id_idx").on(table.livroId),
  ],
);
