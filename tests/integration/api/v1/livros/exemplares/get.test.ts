import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let livroId: string;
let girotecaAId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA01", nome: "Giroteca A" });
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
  const livro = await criarLivro();
  livroId = livro.id;
});

test("GET /api/v1/livros/[id]/exemplares retorna exemplares da giroteca", async () => {
  await criarExemplar(livroId, girotecaAId, { codigoTombamento: "001" });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body).toHaveLength(1);
  expect(body[0].codigoTombamento).toBe("001");
  expect(body[0]).toHaveProperty("nomeLeitor");
});

test("GET não retorna exemplares de outra giroteca", async () => {
  const girotecaB = await criarGiroteca({ codigo: "GB01", nome: "Giroteca B" });
  await criarExemplar(livroId, girotecaB.id, { codigoTombamento: "B-001" });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    { headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveLength(0);
});

test("GET sem auth retorna 401", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
  );
  expect(response.status).toBe(401);
});
