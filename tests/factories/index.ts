import bcrypt from "bcryptjs";
import { db } from "db/index";
import {
  emprestimos,
  exemplares,
  girotecas,
  leitores,
  livros,
  usuarios,
} from "db/schema";

export async function criarGiroteca(
  override: Partial<typeof girotecas.$inferInsert> = {},
) {
  const [row] = await db
    .insert(girotecas)
    .values({
      codigo: `TEST-${Date.now()}`,
      nome: "Giroteca de Teste",
      escolaVinculada: "Escola de Teste",
      ...override,
    })
    .returning();
  return row;
}

export async function criarUsuario(
  override: Partial<typeof usuarios.$inferInsert> & { senha?: string } = {},
) {
  const { senha = "senha@test", ...rest } = override;
  const senhaHash = await bcrypt.hash(senha, 1); // rounds=1 para velocidade nos testes
  const [row] = await db
    .insert(usuarios)
    .values({
      nome: "Usuário de Teste",
      email: `test+${Date.now()}@test.com`,
      senhaHash,
      papel: "gestor_giroteca",
      ativo: true,
      ...rest,
    })
    .returning();
  return { ...row, _senhaPlana: senha };
}

export async function criarLivro(
  override: Partial<typeof livros.$inferInsert> = {},
) {
  const [row] = await db
    .insert(livros)
    .values({
      titulo: "Livro de Teste",
      autores: "Autor de Teste",
      origem: "central",
      ...override,
    })
    .returning();
  return row;
}

export async function criarExemplar(
  livroId: string,
  girotecaId: string,
  override: Partial<typeof exemplares.$inferInsert> = {},
) {
  const [row] = await db
    .insert(exemplares)
    .values({
      livroId,
      girotecaId,
      codigoTombamento: `TOC-${Date.now()}`,
      estado: "bom",
      status: "disponivel",
      ...override,
    })
    .returning();
  return row;
}

export async function criarLeitor(
  girotecaId: string,
  override: Partial<typeof leitores.$inferInsert> = {},
) {
  const [row] = await db
    .insert(leitores)
    .values({
      girotecaId,
      nome: "Leitor de Teste",
      matricula: `MAT-${Date.now()}`,
      tipo: "aluno",
      ativo: true,
      ...override,
    })
    .returning();
  return row;
}

export async function limparBanco() {
  // Ordem importa: FK constraints
  await db.delete(emprestimos);
  await db.delete(exemplares);
  await db.delete(leitores);
  await db.delete(livros);
  await db.delete(usuarios);
  await db.delete(girotecas);
}
