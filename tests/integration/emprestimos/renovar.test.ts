import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  criarEmprestimo,
  limparBanco,
} from "tests/factories";

const BASE_URL = "http://localhost:3000/api/v1/emprestimos";

let cookieAdmin: string;
let girotecaId: string;
let exemplarId: string;
let leitorId: string;
let usuarioAdminId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId);
  exemplarId = exemplar.id;
  const leitor = await criarLeitor(girotecaId);
  leitorId = leitor.id;

  const adminUser = await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  usuarioAdminId = adminUser.id;

  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookieAdmin = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

function criarEmprestimoAtivo(
  override: Parameters<typeof criarEmprestimo>[3] = {},
) {
  return criarEmprestimo(exemplarId, leitorId, usuarioAdminId, override);
}

test("renova empréstimo válido: data avança 14 dias e renovacoes = 1", async () => {
  const emp = await criarEmprestimoAtivo();
  const dataOriginal = emp.dataPrevistaDevolucao;

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.renovacoes).toBe(1);

  const novaData = new Date(body.dataPrevistaDevolucao);
  const esperada = new Date(dataOriginal);
  esperada.setUTCDate(esperada.getUTCDate() + 14);
  expect(novaData.getTime()).toBe(esperada.getTime());
});

test("segunda renovação: renovacoes = 2", async () => {
  const emp = await criarEmprestimoAtivo({ renovacoes: 1 });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.renovacoes).toBe(2);
});

test("terceira renovação bloqueada: 409 LIMITE_RENOVACOES", async () => {
  const emp = await criarEmprestimoAtivo({ renovacoes: 2 });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("LIMITE_RENOVACOES");
});

test("empréstimo em atraso bloqueia renovação: 409 EM_ATRASO", async () => {
  const emp = await criarEmprestimoAtivo({
    dataPrevistaDevolucao: new Date("2000-01-01T00:00:00.000Z"),
  });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("EM_ATRASO");
});

test("empréstimo já devolvido: 409 JA_DEVOLVIDO", async () => {
  const emp = await criarEmprestimoAtivo({ dataDevolucao: new Date() });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("JA_DEVOLVIDO");
});

test("empréstimo inexistente: 404", async () => {
  const res = await fetch(
    `${BASE_URL}/00000000-0000-0000-0000-000000000000/renovar`,
    { method: "POST", headers: { Cookie: cookieAdmin } },
  );
  expect(res.status).toBe(404);
});

test("gestor de outra giroteca não pode renovar: 403", async () => {
  const emp = await criarEmprestimoAtivo();

  const outraGiroteca = await criarGiroteca({
    codigo: `OUTRA-${Date.now()}`,
    nome: "Outra Giroteca",
    escolaVinculada: "Outra Escola",
  });
  await criarUsuario({
    email: "gestorb@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: outraGiroteca.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestorb@test.com", senha: "senha123" }),
  });
  const cookieB = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieB },
  });

  expect(res.status).toBe(403);
});

test("admin NTE pode renovar empréstimo de qualquer giroteca: 200", async () => {
  const emp = await criarEmprestimoAtivo();

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
});

test("cálculo preserva ciclo: vence daqui 4 dias, nova data é daqui 18 dias", async () => {
  const agora = new Date();
  const venceDia14 = new Date(
    Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth(),
      agora.getUTCDate() + 4,
    ),
  );

  const emp = await criarEmprestimoAtivo({ dataPrevistaDevolucao: venceDia14 });

  const res = await fetch(`${BASE_URL}/${emp.id}/renovar`, {
    method: "POST",
    headers: { Cookie: cookieAdmin },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  const novaData = new Date(body.dataPrevistaDevolucao);

  const esperada = new Date(venceDia14);
  esperada.setUTCDate(esperada.getUTCDate() + 14);
  expect(novaData.getTime()).toBe(esperada.getTime());

  const hojeMAis14 = new Date(
    Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth(),
      agora.getUTCDate() + 14,
    ),
  );
  expect(novaData.getTime()).not.toBe(hojeMAis14.getTime());
});
