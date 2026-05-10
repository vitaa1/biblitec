import { atualizar, buscar, criar, listarPorIsbn } from "models/livros";
import type { Contexto } from "lib/auth";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let ctxAdmin: Contexto;
let ctxGestor: Contexto;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestor = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestor = {
    usuarioId: gestor.id,
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  };
});

test("buscar() retorna todos os livros ativos", async () => {
  await criar({ titulo: "Dom Casmurro", autores: "Machado de Assis" }, ctxAdmin);
  await criar({ titulo: "Vidas Secas", autores: "Graciliano Ramos" }, ctxAdmin);
  const resultado = await buscar();
  expect(resultado).toHaveLength(2);
});

test("buscar() filtra por busca textual no título", async () => {
  await criar({ titulo: "Dom Casmurro", autores: "Machado de Assis" }, ctxAdmin);
  await criar({ titulo: "Vidas Secas", autores: "Graciliano Ramos" }, ctxAdmin);
  const resultado = await buscar({ busca: "Dom" });
  expect(resultado).toHaveLength(1);
  expect(resultado[0].titulo).toBe("Dom Casmurro");
});

test("buscar() filtra por categoria", async () => {
  await criar(
    { titulo: "Livro Infantil", autores: "Autor", categoria: "Infantil" },
    ctxAdmin,
  );
  await criar(
    { titulo: "Livro Literatura", autores: "Autor", categoria: "Literatura" },
    ctxAdmin,
  );
  const resultado = await buscar({ categoria: "Infantil" });
  expect(resultado).toHaveLength(1);
  expect(resultado[0].titulo).toBe("Livro Infantil");
});

test("listarPorIsbn() retorna livro existente", async () => {
  await criar(
    { titulo: "Dom Casmurro", autores: "Machado", isbn: "9788535910663" },
    ctxAdmin,
  );
  const livro = await listarPorIsbn("9788535910663");
  expect(livro).not.toBeNull();
  expect(livro!.titulo).toBe("Dom Casmurro");
});

test("listarPorIsbn() retorna null para ISBN desconhecido", async () => {
  const livro = await listarPorIsbn("0000000000000");
  expect(livro).toBeNull();
});

test("criar() com admin define origem central", async () => {
  const livro = await criar({ titulo: "Central", autores: "Autor" }, ctxAdmin);
  expect(livro.origem).toBe("central");
  expect(livro.criadoPorGirotecaId).toBeNull();
});

test("criar() com gestor define origem local e vincula giroteca", async () => {
  const livro = await criar({ titulo: "Local", autores: "Autor" }, ctxGestor);
  expect(livro.origem).toBe("local");
  expect(livro.criadoPorGirotecaId).toBe(ctxGestor.girotecaId);
});

test("criar() com ISBN duplicado lança AppError 409", async () => {
  await criar({ titulo: "L1", autores: "A", isbn: "9788535910663" }, ctxAdmin);
  await expect(
    criar({ titulo: "L2", autores: "B", isbn: "9788535910663" }, ctxAdmin),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("atualizar() gestor não pode editar livro central", async () => {
  const livro = await criar({ titulo: "Central", autores: "Autor" }, ctxAdmin);
  await expect(
    atualizar(livro.id, { titulo: "Novo" }, ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("atualizar() gestor pode editar livro local próprio", async () => {
  const livro = await criar({ titulo: "Local", autores: "Eu" }, ctxGestor);
  const atualizado = await atualizar(livro.id, { titulo: "Editado" }, ctxGestor);
  expect(atualizado.titulo).toBe("Editado");
});

test("atualizar() ISBN duplicado lança AppError 409", async () => {
  const l1 = await criar({ titulo: "L1", autores: "A", isbn: "1111111111111" }, ctxAdmin);
  await criar({ titulo: "L2", autores: "B", isbn: "2222222222222" }, ctxAdmin);
  await expect(
    atualizar(l1.id, { isbn: "2222222222222" }, ctxAdmin),
  ).rejects.toMatchObject({ status_code: 409 });
});
