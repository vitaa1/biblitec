import jwt from "jsonwebtoken";
import {
  assinarToken,
  getCurrentUser,
  getUserFromHeaders,
  hashSenha,
  requireRole,
  verificarSenha,
  verificarToken,
} from "lib/auth";
import { AppError } from "infra/errors";

function makeRequest(cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return new Request("http://localhost/api/test", { headers });
}

test("assinarToken() retorna string JWT com três partes", () => {
  const token = assinarToken({
    id: "abc123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3);
});

test("verificarToken() decodifica payload assinado", () => {
  const token = assinarToken({
    id: "abc123",
    papel: "gestor_giroteca",
    girotecaId: "giro-1",
  });
  const payload = verificarToken(token);
  expect(payload.id).toBe("abc123");
  expect(payload.papel).toBe("gestor_giroteca");
  expect(payload.girotecaId).toBe("giro-1");
});

test("verificarToken() lança erro com token malformado", () => {
  expect(() => verificarToken("token.invalido.aqui")).toThrow();
});

test("hashSenha() retorna hash bcrypt válido", async () => {
  const hash = await hashSenha("minha@senha");
  expect(hash).toMatch(/^\$2[ab]\$/);
  expect(hash).not.toBe("minha@senha");
});

test("verificarSenha() retorna true com senha correta", async () => {
  const hash = await hashSenha("minha@senha");
  expect(await verificarSenha("minha@senha", hash)).toBe(true);
});

test("verificarSenha() retorna false com senha errada", async () => {
  const hash = await hashSenha("minha@senha");
  expect(await verificarSenha("errada", hash)).toBe(false);
});

test("getCurrentUser() retorna null sem cookie", async () => {
  expect(await getCurrentUser(makeRequest())).toBeNull();
});

test("getCurrentUser() retorna null com token malformado", async () => {
  expect(await getCurrentUser(makeRequest("biblitec_session=isso.nao.e.um.jwt"))).toBeNull();
});

test("getCurrentUser() retorna Contexto com token válido", async () => {
  const token = assinarToken({ id: "abc", papel: "admin_nthe", girotecaId: null });
  const ctx = await getCurrentUser(makeRequest(`biblitec_session=${token}`));
  expect(ctx).not.toBeNull();
  expect(ctx!.usuarioId).toBe("abc");
  expect(ctx!.papel).toBe("admin_nthe");
  expect(ctx!.girotecaId).toBeNull();
});

test("getCurrentUser() retorna null com token assinado com segredo errado", async () => {
  const token = jwt.sign(
    { id: "x", papel: "admin_nthe", girotecaId: null },
    "segredo-errado",
    { expiresIn: "1d" },
  );
  expect(await getCurrentUser(makeRequest(`biblitec_session=${token}`))).toBeNull();
});

const ctxAdmin = { usuarioId: "u1", papel: "admin_nthe" as const, girotecaId: null };
const ctxGestor = { usuarioId: "u2", papel: "gestor_giroteca" as const, girotecaId: "g1" };

test("requireRole() retorna contexto quando papel bate", () => {
  expect(requireRole(ctxAdmin, "admin_nthe")).toBe(ctxAdmin);
  expect(requireRole(ctxGestor, "gestor_giroteca")).toBe(ctxGestor);
});

test("requireRole() lança 403 quando papel não tem permissão", () => {
  expect(() => requireRole(ctxGestor, "admin_nthe")).toThrow(AppError);
  expect(() => requireRole(ctxGestor, "admin_nthe")).toThrow(
    expect.objectContaining({ status_code: 403 }),
  );
});

test("requireRole() lança 401 quando contexto é null", () => {
  expect(() => requireRole(null, "admin_nthe")).toThrow(AppError);
  expect(() => requireRole(null, "admin_nthe")).toThrow(
    expect.objectContaining({ status_code: 401 }),
  );
});

test("getUserFromHeaders() retorna Contexto com headers válidos", () => {
  const headers = new Headers({
    "x-user-id": "abc",
    "x-user-papel": "admin_nthe",
    "x-user-giroteca-id": "",
  });
  const ctx = getUserFromHeaders(headers);
  expect(ctx).not.toBeNull();
  expect(ctx!.usuarioId).toBe("abc");
  expect(ctx!.papel).toBe("admin_nthe");
  expect(ctx!.girotecaId).toBeNull();
});

test("getUserFromHeaders() preserva girotecaId quando presente", () => {
  const headers = new Headers({
    "x-user-id": "xyz",
    "x-user-papel": "gestor_giroteca",
    "x-user-giroteca-id": "giro-1",
  });
  const ctx = getUserFromHeaders(headers);
  expect(ctx!.girotecaId).toBe("giro-1");
});

test("getUserFromHeaders() retorna null sem x-user-id", () => {
  expect(getUserFromHeaders(new Headers())).toBeNull();
});

test("getUserFromHeaders() retorna null com papel inválido", () => {
  const headers = new Headers({
    "x-user-id": "abc",
    "x-user-papel": "role_desconhecida",
  });
  expect(getUserFromHeaders(headers)).toBeNull();
});
