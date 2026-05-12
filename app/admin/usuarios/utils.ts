const CHARS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  special: "!@#$%^&*",
};

export function gerarSenhaTemporaria(): string {
  const todos = CHARS.upper + CHARS.lower + CHARS.digits + CHARS.special;
  const obrigatorios = [
    CHARS.upper[Math.floor(Math.random() * CHARS.upper.length)],
    CHARS.lower[Math.floor(Math.random() * CHARS.lower.length)],
    CHARS.digits[Math.floor(Math.random() * CHARS.digits.length)],
    CHARS.special[Math.floor(Math.random() * CHARS.special.length)],
  ];
  const resto = Array.from(
    { length: 8 },
    () => todos[Math.floor(Math.random() * todos.length)],
  );
  return [...obrigatorios, ...resto].sort(() => Math.random() - 0.5).join("");
}
