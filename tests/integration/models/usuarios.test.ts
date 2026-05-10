import { autenticar, criar, listarPorGiroteca } from "models/usuarios";
import type { Contexto } from "lib/auth";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "UA01", nome: "Giroteca A" });
  await criarGiroteca({ codigo: "UB01", nome: "Giroteca B" });
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

test("autenticar() retorna usuário com credenciais corretas", async () => {
  const u = await criarUsuario({
    email: "usuario@test.com",
    senha: "minha@senha",
  });
  const resultado = await autenticar("usuario@test.com", "minha@senha");
  expect(resultado.id).toBe(u.id);
  expect((resultado as any).senhaHash).toBeUndefined();
});

test("autenticar() falha com senha errada", async () => {
  await criarUsuario({ email: "usuario@test.com", senha: "correta" });
  await expect(
    autenticar("usuario@test.com", "errada"),
  ).rejects.toMatchObject({ status_code: 401 });
});

test("autenticar() falha com email inexistente", async () => {
  await expect(
    autenticar("naoexiste@test.com", "qualquer"),
  ).rejects.toMatchObject({ status_code: 401 });
});

test("criar() admin cria gestor vinculado à giroteca", async () => {
  const novo = await criar(
    {
      nome: "Novo Gestor",
      email: "novo@test.com",
      senha: "senha@forte",
      papel: "gestor_giroteca",
      girotecaId: girotecaA.id,
    },
    ctxAdmin,
  );
  expect(novo.papel).toBe("gestor_giroteca");
  expect(novo.girotecaId).toBe(girotecaA.id);
  expect((novo as any).senhaHash).toBeUndefined();
});

test("criar() gestor não pode criar usuários", async () => {
  await expect(
    criar(
      {
        nome: "Tentativa",
        email: "hack@test.com",
        senha: "senha123",
        papel: "gestor_giroteca",
        girotecaId: girotecaA.id,
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("criar() gestor sem girotecaId lança erro 400", async () => {
  await expect(
    criar(
      {
        nome: "Sem Giroteca",
        email: "semg@test.com",
        senha: "senha123",
        papel: "gestor_giroteca",
      },
      ctxAdmin,
    ),
  ).rejects.toMatchObject({ status_code: 400 });
});

test("criar() email duplicado lança AppError 409", async () => {
  await criarUsuario({ email: "dup@test.com" });
  await expect(
    criar(
      {
        nome: "Dup",
        email: "dup@test.com",
        senha: "senha123",
        papel: "gestor_giroteca",
        girotecaId: girotecaA.id,
      },
      ctxAdmin,
    ),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("autenticar() falha com usuário inativo", async () => {
  const u = await criarUsuario({ email: "inativo@test.com", senha: "senha123" });
  // deactivate user directly in DB
  const { db } = await import("db/index");
  const { usuarios } = await import("db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(usuarios).set({ ativo: false }).where(eq(usuarios.id, u.id));
  await expect(
    autenticar("inativo@test.com", "senha123"),
  ).rejects.toMatchObject({ status_code: 401 });
});

test("autenticar() aceita email com uppercase", async () => {
  await criarUsuario({ email: "normal@test.com", senha: "senha123" });
  const resultado = await autenticar("NORMAL@TEST.COM", "senha123");
  expect(resultado.email).toBe("normal@test.com");
});

test("criar() permite reutilizar email de usuário inativo", async () => {
  const u1 = await criarUsuario({ email: "reutilizar@test.com", senha: "senha123" });
  // deactivate user directly in DB
  const { db } = await import("db/index");
  const { usuarios } = await import("db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(usuarios).set({ ativo: false }).where(eq(usuarios.id, u1.id));
  // should allow creating new user with same email
  const u2 = await criar(
    {
      nome: "Novo",
      email: "reutilizar@test.com",
      senha: "senha456",
      papel: "gestor_giroteca",
      girotecaId: girotecaA.id,
    },
    ctxAdmin,
  );
  expect(u2.email).toBe("reutilizar@test.com");
  expect(u2.id).not.toBe(u1.id);
});

test("listarPorGiroteca() retorna usuários da giroteca", async () => {
  await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const lista = await listarPorGiroteca(girotecaA.id, ctxAdmin);
  // admin + 2 gestores (created in beforeEach + this test)
  expect(lista.length).toBeGreaterThanOrEqual(1);
  expect(lista.every((u) => u.girotecaId === girotecaA.id)).toBe(true);
});

test("listarPorGiroteca() gestor não pode ver outra giroteca", async () => {
  const girotecaB = await criarGiroteca({ codigo: "OUTRAB", nome: "Outra" });
  await expect(
    listarPorGiroteca(girotecaB.id, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});
