import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const papelUsuarioEnum = pgEnum("papel_usuario", [
  "admin_nthe",
  "gestor_giroteca",
]);

export const categoriaLivroEnum = pgEnum("categoria_livro", [
  "Infantil",
  "Juvenil",
  "Didático",
  "Literatura",
  "Outros",
]);

export const origemLivroEnum = pgEnum("origem_livro", ["central", "local"]);

export const estadoExemplarEnum = pgEnum("estado_exemplar", [
  "novo",
  "bom",
  "regular",
  "danificado",
]);

export const statusExemplarEnum = pgEnum("status_exemplar", [
  "disponivel",
  "emprestado",
  "baixado",
]);

export const tipoLeitorEnum = pgEnum("tipo_leitor", [
  "aluno",
  "professor",
  "funcionario",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const girotecas = pgTable("girotecas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 50 }).notNull().unique(),
  escolaVinculada: varchar("escola_vinculada", { length: 255 }).notNull(),
  endereco: text("endereco"),
  ativa: boolean("ativa").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
    papel: papelUsuarioEnum("papel").notNull(),
    // NULL para admin_nthe (não vinculado a uma giroteca específica)
    girotecaId: uuid("giroteca_id").references(() => girotecas.id, {
      onDelete: "restrict",
    }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Email único apenas entre usuários ativos — inativados podem ter o email reutilizado
    uniqueIndex("usuarios_email_ativo_idx")
      .on(table.email)
      .where(sql`${table.ativo} = true`),
  ],
);

export const livros = pgTable(
  "livros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    autores: varchar("autores", { length: 500 }).notNull(),
    // Nullable: ISBN é campo opcional no formulário
    isbn: varchar("isbn", { length: 20 }).unique(),
    editora: varchar("editora", { length: 255 }),
    anoPublicacao: integer("ano_publicacao"),
    categoria: categoriaLivroEnum("categoria"),
    capaUrl: text("capa_url"),
    descricao: text("descricao"),
    origem: origemLivroEnum("origem").notNull().default("central"),
    criadoPorGirotecaId: uuid("criado_por_giroteca_id").references(
      () => girotecas.id,
      { onDelete: "restrict" },
    ),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletadoEm: timestamp("deletado_em", { withTimezone: true }),
  },
  (table) => [
    index("livros_titulo_idx").on(table.titulo),
    index("livros_isbn_idx").on(table.isbn),
  ],
);

export const exemplares = pgTable(
  "exemplares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    livroId: uuid("livro_id")
      .notNull()
      .references(() => livros.id, { onDelete: "restrict" }),
    girotecaId: uuid("giroteca_id")
      .notNull()
      .references(() => girotecas.id, { onDelete: "restrict" }),
    codigoTombamento: varchar("codigo_tombamento", { length: 50 }).notNull(),
    estado: estadoExemplarEnum("estado").notNull().default("bom"),
    status: statusExemplarEnum("status").notNull().default("disponivel"),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Código de tombamento é único por giroteca, não globalmente
    uniqueIndex("exemplares_tombamento_giroteca_idx").on(
      table.codigoTombamento,
      table.girotecaId,
    ),
    index("exemplares_livro_id_idx").on(table.livroId),
    index("exemplares_giroteca_id_idx").on(table.girotecaId),
  ],
);

export const leitores = pgTable(
  "leitores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    girotecaId: uuid("giroteca_id")
      .notNull()
      .references(() => girotecas.id, { onDelete: "restrict" }),
    nome: varchar("nome", { length: 255 }).notNull(),
    matricula: varchar("matricula", { length: 50 }),
    turma: varchar("turma", { length: 100 }),
    tipo: tipoLeitorEnum("tipo").notNull().default("aluno"),
    telefone: varchar("telefone", { length: 20 }),
    // Obrigatório para tipo = aluno (validação em models/, não no banco)
    responsavel: varchar("responsavel", { length: 255 }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Matrícula é única por giroteca, não globalmente
    uniqueIndex("leitores_matricula_giroteca_idx").on(
      table.matricula,
      table.girotecaId,
    ),
    index("leitores_nome_idx").on(table.nome),
  ],
);

export const emprestimos = pgTable(
  "emprestimos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exemplarId: uuid("exemplar_id")
      .notNull()
      .references(() => exemplares.id, { onDelete: "restrict" }),
    leitorId: uuid("leitor_id")
      .notNull()
      .references(() => leitores.id, { onDelete: "restrict" }),
    registradoPorId: uuid("registrado_por_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    dataEmprestimo: timestamp("data_emprestimo", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dataPrevistaDevolucao: timestamp("data_prevista_devolucao", {
      withTimezone: true,
    }).notNull(),
    // NULL = ainda em aberto
    dataDevolucao: timestamp("data_devolucao", { withTimezone: true }),
    renovacoes: integer("renovacoes").notNull().default(0),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("emprestimos_exemplar_id_idx").on(table.exemplarId),
    index("emprestimos_leitor_id_idx").on(table.leitorId),
    index("emprestimos_registrado_por_id_idx").on(table.registradoPorId),
  ],
);
