import { gerarSenhaTemporaria } from "@/app/admin/usuarios/utils";

describe("gerarSenhaTemporaria", () => {
  it("gera senha com 12 caracteres", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toHaveLength(12);
  });

  it("gera senha contendo letra maiúscula", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[A-Z]/);
  });

  it("gera senha contendo letra minúscula", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[a-z]/);
  });

  it("gera senha contendo dígito", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[0-9]/);
  });

  it("gera senha contendo caractere especial", () => {
    const senha = gerarSenhaTemporaria();
    expect(senha).toMatch(/[!@#$%^&*]/);
  });

  it("gera senhas diferentes a cada chamada", () => {
    const senhas = new Set(
      Array.from({ length: 10 }, () => gerarSenhaTemporaria()),
    );
    expect(senhas.size).toBeGreaterThan(1);
  });
});
