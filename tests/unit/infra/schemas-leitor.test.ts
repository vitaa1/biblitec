import { createLeitorSchema, updateLeitorSchema } from "infra/schemas";

describe("createLeitorSchema", () => {
  test("aceita payload válido com todos os campos", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana Lúcia",
      girotecaId: "00000000-0000-4000-8000-000000000001",
      tipo: "aluno",
      matricula: "MAT-001",
      turma: "5A",
      telefone: "(86) 99999-0000",
      responsavel: "Maria da Silva",
    });
    expect(result.success).toBe(true);
  });

  test("aceita telefone fixo (10 dígitos)", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-4000-8000-000000000001",
      telefone: "(86) 3333-0000",
    });
    expect(result.success).toBe(true);
  });

  test("rejeita telefone com formato inválido", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-4000-8000-000000000001",
      telefone: "86999990000",
    });
    expect(result.success).toBe(false);
  });

  test("rejeita matricula acima de 50 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-4000-8000-000000000001",
      matricula: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  test("rejeita turma acima de 100 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-4000-8000-000000000001",
      turma: "T".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  test("rejeita nome acima de 255 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "A".repeat(256),
      girotecaId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  test("rejeita responsavel acima de 255 chars", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-4000-8000-000000000001",
      responsavel: "R".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  test("telefone opcional — aceita sem o campo", () => {
    const result = createLeitorSchema.safeParse({
      nome: "Ana",
      girotecaId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateLeitorSchema", () => {
  test("rejeita telefone com formato inválido", () => {
    const result = updateLeitorSchema.safeParse({ telefone: "99999-0000" });
    expect(result.success).toBe(false);
  });

  test("aceita telefone null (remover)", () => {
    const result = updateLeitorSchema.safeParse({ telefone: null });
    expect(result.success).toBe(true);
  });

  test("aceita payload vazio (todos opcionais)", () => {
    const result = updateLeitorSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
