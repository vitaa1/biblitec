import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const login = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = login.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/leitores/[id]/desativar retorna 204", async () => {
  const leitor = await criarLeitor(girotecaA.id);

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}/desativar`,
    { method: "POST", headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(204);
});

test("POST desativar leitor não aparece em busca posterior", async () => {
  const leitor = await criarLeitor(girotecaA.id);

  await fetch(`http://localhost:3000/api/v1/leitores/${leitor.id}/desativar`, {
    method: "POST",
    headers: { Cookie: gestorCookie },
  });

  const listaRes = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: gestorCookie },
  });
  const lista = await listaRes.json();
  expect(
    lista.leitores.some((l: { id: string }) => l.id === leitor.id),
  ).toBe(false);
});

test("POST desativar retorna 404 para leitor inexistente", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/leitores/00000000-0000-0000-0000-000000000000/desativar",
    { method: "POST", headers: { Cookie: gestorCookie } },
  );
  expect(res.status).toBe(404);
});

test("POST desativar retorna 403 para leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}/desativar`,
    { method: "POST", headers: { Cookie: gestorCookie } },
  );
  expect(res.status).toBe(403);
});

test("POST desativar ID inválido retorna 400", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/leitores/nao-e-uuid/desativar",
    { method: "POST", headers: { Cookie: gestorCookie } },
  );
  expect(res.status).toBe(400);
});
