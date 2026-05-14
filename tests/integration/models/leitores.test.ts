import {
  atualizar,
  buscar,
  buscarPorId,
  criar,
  desativar,
} from "models/leitores";
import type { Contexto } from "lib/auth";
import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "LA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "LB01", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

// ─── buscar ───────────────────────────────────────────────────────────────────

test("buscar() gestor vê leitores da própria giroteca", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaB.id, { nome: "João Sousa" });
  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("buscar() admin vê leitores de todas as girotecas", async () => {
  await criarLeitor(girotecaA.id);
  await criarLeitor(girotecaB.id);
  const { leitores: lista } = await buscar({}, ctxAdmin);
  expect(lista).toHaveLength(2);
});

test("buscar() admin com girotecaId filtra por unidade", async () => {
  await criarLeitor(girotecaA.id, { nome: "Leitor A" });
  await criarLeitor(girotecaB.id, { nome: "Leitor B" });
  const { leitores: lista } = await buscar(
    { girotecaId: girotecaA.id },
    ctxAdmin,
  );
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Leitor A");
});

test("buscar() filtra por nome", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaA.id, {
    nome: "Carlos Sousa",
    matricula: "MAT-999",
  });
  const { leitores: lista } = await buscar({ busca: "Ana" }, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("buscar() busca parcial com acentuação encontra leitor", async () => {
  await criarLeitor(girotecaA.id, { nome: "João Silva" });
  const { leitores: lista } = await buscar({ busca: "joã" }, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("João Silva");
});

test("buscar() não retorna leitores inativos", async () => {
  await criarLeitor(girotecaA.id, { ativo: false });
  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista).toHaveLength(0);
});

test("buscar() retorna total correto para paginação", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana", matricula: "M1" });
  await criarLeitor(girotecaA.id, { nome: "Bruno", matricula: "M2" });
  const { total } = await buscar({}, ctxGestorA);
  expect(total).toBe(2);
});

test("buscar() retorna emprestimosEmAberto por leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  await criarEmprestimo(exemplar.id, leitor.id, admin.id);

  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista[0].emprestimosEmAberto).toBe(1);
});

test("buscar() emprestimosEmAberto é 0 quando devolvido", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  await criarEmprestimo(exemplar.id, leitor.id, admin.id, {
    dataDevolucao: new Date(),
  });

  const { leitores: lista } = await buscar({}, ctxGestorA);
  expect(lista[0].emprestimosEmAberto).toBe(0);
});

// ─── criar ────────────────────────────────────────────────────────────────────

test("criar() cria leitor na giroteca do gestor", async () => {
  const leitor = await criar(
    {
      girotecaId: girotecaA.id,
      nome: "Maria Souza",
      matricula: "2024-001",
      tipo: "aluno",
    },
    ctxGestorA,
  );
  expect(leitor.girotecaId).toBe(girotecaA.id);
  expect(leitor.ativo).toBe(true);
});

test("criar() gestor não pode criar leitor em outra giroteca", async () => {
  await expect(
    criar(
      {
        girotecaId: girotecaB.id,
        nome: "Fulano",
        matricula: "2024-002",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("criar() MATRICULA_DUPLICADA quando matrícula já existe na giroteca", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-DUPLICADA" });
  await expect(
    criar(
      {
        girotecaId: girotecaA.id,
        nome: "Outro Leitor",
        matricula: "MAT-DUPLICADA",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 409, code: "MATRICULA_DUPLICADA" });
});

test("criar() mesma matrícula em girotecas diferentes é permitida", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-001" });
  const leitor = await criar(
    { girotecaId: girotecaB.id, nome: "Leitor B", matricula: "MAT-001" },
    ctxAdmin,
  );
  expect(leitor.girotecaId).toBe(girotecaB.id);
});

// ─── atualizar ────────────────────────────────────────────────────────────────

test("atualizar() atualiza nome do leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Antigo Nome" });
  const atualizado = await atualizar(
    leitor.id,
    { nome: "Novo Nome" },
    ctxGestorA,
  );
  expect(atualizado.nome).toBe("Novo Nome");
});

test("atualizar() gestor não pode atualizar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(
    atualizar(leitor.id, { nome: "Hackeado" }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

// ─── desativar ────────────────────────────────────────────────────────────────

test("desativar() marca leitor como inativo", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  await desativar(leitor.id, ctxGestorA);
  const atualizado = await buscarPorId(leitor.id, ctxAdmin);
  expect(atualizado.ativo).toBe(false);
});

test("desativar() gestor não pode desativar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(desativar(leitor.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 403,
  });
});

// ─── buscarPorId ──────────────────────────────────────────────────────────────

test("buscarPorId() retorna o leitor pelo id", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Específico" });
  const encontrado = await buscarPorId(leitor.id, ctxGestorA);
  expect(encontrado.nome).toBe("Específico");
});

test("buscarPorId() gestor não vê leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(buscarPorId(leitor.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 403,
  });
});

test("buscarPorId() lança 404 quando leitor não existe", async () => {
  await expect(
    buscarPorId("00000000-0000-0000-0000-000000000000", ctxAdmin),
  ).rejects.toMatchObject({ status_code: 404 });
});
