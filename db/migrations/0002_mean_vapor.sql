CREATE TYPE "public"."categoria_livro" AS ENUM('Infantil', 'Juvenil', 'Didático', 'Literatura', 'Outros');--> statement-breakpoint
CREATE TYPE "public"."estado_exemplar" AS ENUM('novo', 'bom', 'regular', 'danificado');--> statement-breakpoint
CREATE TYPE "public"."origem_livro" AS ENUM('central', 'local');--> statement-breakpoint
CREATE TYPE "public"."status_exemplar" AS ENUM('disponivel', 'emprestado', 'baixado');--> statement-breakpoint
CREATE TYPE "public"."tipo_leitor" AS ENUM('aluno', 'professor', 'funcionario');--> statement-breakpoint
CREATE TABLE "exemplares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"livro_id" uuid NOT NULL,
	"giroteca_id" uuid NOT NULL,
	"codigo_tombamento" varchar(50) NOT NULL,
	"estado" "estado_exemplar" DEFAULT 'bom' NOT NULL,
	"status" "status_exemplar" DEFAULT 'disponivel' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "girotecas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"escola_vinculada" varchar(255) NOT NULL,
	"endereco" text,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "girotecas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "leitores" DROP CONSTRAINT "leitores_matricula_unique";--> statement-breakpoint
ALTER TABLE "emprestimos" DROP CONSTRAINT "emprestimos_criado_por_usuario_id_usuarios_id_fk";
--> statement-breakpoint
ALTER TABLE "emprestimos" DROP CONSTRAINT "emprestimos_livro_id_livros_id_fk";
--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "papel" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "papel" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."papel_usuario";--> statement-breakpoint
CREATE TYPE "public"."papel_usuario" AS ENUM('admin_nthe', 'gestor_giroteca');--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "papel" SET DATA TYPE "public"."papel_usuario" USING "papel"::"public"."papel_usuario";--> statement-breakpoint
DROP INDEX "emprestimos_criado_por_usuario_id_idx";--> statement-breakpoint
DROP INDEX "emprestimos_livro_id_idx";--> statement-breakpoint
ALTER TABLE "emprestimos" ALTER COLUMN "data_devolucao" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "livros" ALTER COLUMN "isbn" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "exemplar_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "registrado_por_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "data_emprestimo" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "data_prevista_devolucao" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "renovacoes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "giroteca_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "turma" varchar(100);--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "tipo" "tipo_leitor" DEFAULT 'aluno' NOT NULL;--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "telefone" varchar(20);--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "responsavel" varchar(255);--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leitores" ADD COLUMN "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "autores" varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "editora" varchar(255);--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "ano_publicacao" integer;--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "categoria" "categoria_livro";--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "capa_url" varchar(500);--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "origem" "origem_livro" DEFAULT 'central' NOT NULL;--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "criado_por_giroteca_id" uuid;--> statement-breakpoint
ALTER TABLE "livros" ADD COLUMN "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "senha_hash" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "giroteca_id" uuid;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "exemplares" ADD CONSTRAINT "exemplares_livro_id_livros_id_fk" FOREIGN KEY ("livro_id") REFERENCES "public"."livros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemplares" ADD CONSTRAINT "exemplares_giroteca_id_girotecas_id_fk" FOREIGN KEY ("giroteca_id") REFERENCES "public"."girotecas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exemplares_tombamento_giroteca_idx" ON "exemplares" USING btree ("codigo_tombamento","giroteca_id");--> statement-breakpoint
CREATE INDEX "exemplares_livro_id_idx" ON "exemplares" USING btree ("livro_id");--> statement-breakpoint
CREATE INDEX "exemplares_giroteca_id_idx" ON "exemplares" USING btree ("giroteca_id");--> statement-breakpoint
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_exemplar_id_exemplares_id_fk" FOREIGN KEY ("exemplar_id") REFERENCES "public"."exemplares"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leitores" ADD CONSTRAINT "leitores_giroteca_id_girotecas_id_fk" FOREIGN KEY ("giroteca_id") REFERENCES "public"."girotecas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livros" ADD CONSTRAINT "livros_criado_por_giroteca_id_girotecas_id_fk" FOREIGN KEY ("criado_por_giroteca_id") REFERENCES "public"."girotecas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_giroteca_id_girotecas_id_fk" FOREIGN KEY ("giroteca_id") REFERENCES "public"."girotecas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emprestimos_exemplar_id_idx" ON "emprestimos" USING btree ("exemplar_id");--> statement-breakpoint
CREATE INDEX "emprestimos_registrado_por_id_idx" ON "emprestimos" USING btree ("registrado_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leitores_matricula_giroteca_idx" ON "leitores" USING btree ("matricula","giroteca_id");--> statement-breakpoint
CREATE INDEX "leitores_nome_idx" ON "leitores" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "livros_titulo_idx" ON "livros" USING btree ("titulo");--> statement-breakpoint
CREATE INDEX "livros_isbn_idx" ON "livros" USING btree ("isbn");--> statement-breakpoint
ALTER TABLE "emprestimos" DROP COLUMN "criado_por_usuario_id";--> statement-breakpoint
ALTER TABLE "emprestimos" DROP COLUMN "livro_id";--> statement-breakpoint
ALTER TABLE "emprestimos" DROP COLUMN "emprestado_em";--> statement-breakpoint
ALTER TABLE "emprestimos" DROP COLUMN "devolvido_em";--> statement-breakpoint
ALTER TABLE "emprestimos" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "livros" DROP COLUMN "autor";--> statement-breakpoint
ALTER TABLE "livros" DROP COLUMN "ano";--> statement-breakpoint
ALTER TABLE "livros" DROP COLUMN "quantidade";--> statement-breakpoint
ALTER TABLE "livros" DROP COLUMN "quantidade_disponivel";--> statement-breakpoint
ALTER TABLE "usuarios" DROP COLUMN "senha";--> statement-breakpoint
DROP TYPE "public"."status_emprestimo";