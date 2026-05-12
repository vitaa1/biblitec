import {
  assinarToken,
  hashSenha,
  verificarSenha,
  verificarToken,
} from "lib/auth";

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
