import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

const mockCookieSet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => Promise.resolve({ set: mockCookieSet })),
}));

const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

beforeEach(async () => {
  await limparBanco();
  jest.clearAllMocks();
  const giroteca = await criarGiroteca();
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
});

async function importAction() {
  jest.resetModules();
  const mod = await import("app/(auth)/login/actions");
  return mod.loginAction;
}

test("loginAction seta cookie httpOnly e redireciona com credenciais válidas", async () => {
  const loginAction = await importAction();
  const formData = new FormData();
  formData.set("email", "gestor@test.com");
  formData.set("senha", "senha123");

  await loginAction(null, formData);

  expect(mockCookieSet).toHaveBeenCalledWith(
    "token",
    expect.any(String),
    expect.objectContaining({ httpOnly: true }),
  );
  expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
});

test("loginAction retorna erro com senha errada", async () => {
  const loginAction = await importAction();
  const formData = new FormData();
  formData.set("email", "gestor@test.com");
  formData.set("senha", "errada");

  const result = await loginAction(null, formData);

  expect(result).toMatchObject({ ok: false, error: expect.any(String) });
  expect(mockCookieSet).not.toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
});

test("loginAction retorna erro com email ausente", async () => {
  const loginAction = await importAction();
  const formData = new FormData();
  formData.set("senha", "senha123");

  const result = await loginAction(null, formData);

  expect(result).toMatchObject({ ok: false, error: expect.any(String) });
});

test("loginAction retorna erro com email inexistente", async () => {
  const loginAction = await importAction();
  const formData = new FormData();
  formData.set("email", "naoexiste@test.com");
  formData.set("senha", "senha123");

  const result = await loginAction(null, formData);

  expect(result).toMatchObject({ ok: false, error: expect.any(String) });
});
