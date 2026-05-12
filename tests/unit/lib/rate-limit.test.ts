import { criarRateLimiter } from "lib/rate-limit";

test("não bloqueia abaixo do limite", () => {
  const limiter = criarRateLimiter({ maxTentativas: 3, janelaSeg: 60 });
  limiter.registrarFalha("email-a");
  limiter.registrarFalha("email-a");
  expect(limiter.bloqueado("email-a")).toBe(false);
});

test("bloqueia ao atingir o limite de falhas", () => {
  const limiter = criarRateLimiter({ maxTentativas: 3, janelaSeg: 60 });
  limiter.registrarFalha("email-a");
  limiter.registrarFalha("email-a");
  limiter.registrarFalha("email-a");
  expect(limiter.bloqueado("email-a")).toBe(true);
});

test("bloqueado() não incrementa o contador", () => {
  const limiter = criarRateLimiter({ maxTentativas: 1, janelaSeg: 60 });
  limiter.registrarFalha("email-a");
  limiter.bloqueado("email-a");
  limiter.bloqueado("email-a");
  expect(limiter.restantes("email-a")).toBe(0);
});

test("chaves diferentes não interferem entre si", () => {
  const limiter = criarRateLimiter({ maxTentativas: 1, janelaSeg: 60 });
  limiter.registrarFalha("email-a");
  expect(limiter.bloqueado("email-b")).toBe(false);
});

test("reseta após a janela de tempo expirar", () => {
  jest.useFakeTimers();
  const limiter = criarRateLimiter({ maxTentativas: 2, janelaSeg: 10 });

  limiter.registrarFalha("email-a");
  limiter.registrarFalha("email-a");
  expect(limiter.bloqueado("email-a")).toBe(true);

  jest.advanceTimersByTime(10_001);

  expect(limiter.bloqueado("email-a")).toBe(false);
  jest.useRealTimers();
});

test("retorna tentativas restantes", () => {
  const limiter = criarRateLimiter({ maxTentativas: 3, janelaSeg: 60 });
  limiter.registrarFalha("email-a");
  expect(limiter.restantes("email-a")).toBe(2);
  limiter.registrarFalha("email-a");
  expect(limiter.restantes("email-a")).toBe(1);
});
