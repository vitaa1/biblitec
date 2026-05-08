CREATE TYPE "public"."papel_usuario" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TYPE "public"."status_emprestimo" AS ENUM('ACTIVE', 'RETURNED', 'OVERDUE');--> statement-breakpoint
CREATE TABLE "emprestimos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leitor_id" uuid NOT NULL,
	"criado_por_usuario_id" uuid NOT NULL,
	"livro_id" uuid NOT NULL,
	"emprestado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"data_devolucao" timestamp with time zone NOT NULL,
	"devolvido_em" timestamp with time zone,
	"status" "status_emprestimo" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leitores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"matricula" varchar(50) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leitores_matricula_unique" UNIQUE("matricula")
);
--> statement-breakpoint
CREATE TABLE "livros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"autor" varchar(255) NOT NULL,
	"isbn" varchar(20) NOT NULL,
	"ano" integer NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"quantidade_disponivel" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"deletado_em" timestamp with time zone,
	CONSTRAINT "livros_isbn_unique" UNIQUE("isbn")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"senha" varchar(255) NOT NULL,
	"nome" varchar(255) NOT NULL,
	"papel" "papel_usuario" DEFAULT 'ADMIN' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_leitor_id_leitores_id_fk" FOREIGN KEY ("leitor_id") REFERENCES "public"."leitores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_criado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_livro_id_livros_id_fk" FOREIGN KEY ("livro_id") REFERENCES "public"."livros"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emprestimos_leitor_id_idx" ON "emprestimos" USING btree ("leitor_id");--> statement-breakpoint
CREATE INDEX "emprestimos_criado_por_usuario_id_idx" ON "emprestimos" USING btree ("criado_por_usuario_id");--> statement-breakpoint
CREATE INDEX "emprestimos_livro_id_idx" ON "emprestimos" USING btree ("livro_id");