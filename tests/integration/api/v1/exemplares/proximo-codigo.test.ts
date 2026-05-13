import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let girotecaAId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA03", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/exemplares/proximo-codigo retorna '1' quando não há exemplares", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaAId}`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.proximo).toBe("1");
});

test("GET retorna max+1 para códigos numéricos existentes", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaAId, { codigoTombamento: "5" });
  await criarExemplar(livro.id, girotecaAId, { codigoTombamento: "3" });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaAId}`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.proximo).toBe("6");
});

test("GET sem girotecaId usa giroteca do contexto do gestor", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/proximo-codigo",
    { headers: { Cookie: cookie } },
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.proximo).toBe("1");
});

test("GET admin sem girotecaId no param retorna 400", async () => {
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  const adminCookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/proximo-codigo",
    { headers: { Cookie: adminCookie } },
  );
  expect(response.status).toBe(400);
});

test("GET sem auth retorna 401", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaAId}`,
  );
  expect(response.status).toBe(401);
});

test("GET gestor não pode consultar outra giroteca — retorna 403", async () => {
  const girotecaB = await criarGiroteca({ codigo: "GB03", nome: "Giroteca B" });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaB.id}`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(403);
});
