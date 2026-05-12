const CHARS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  special: "!@#$%^&*",
};

function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function gerarSenhaTemporaria(): string {
  const todos = CHARS.upper + CHARS.lower + CHARS.digits + CHARS.special;
  const arr = [
    CHARS.upper[secureRandomInt(CHARS.upper.length)],
    CHARS.lower[secureRandomInt(CHARS.lower.length)],
    CHARS.digits[secureRandomInt(CHARS.digits.length)],
    CHARS.special[secureRandomInt(CHARS.special.length)],
    ...Array.from({ length: 8 }, () => todos[secureRandomInt(todos.length)]),
  ];
  // Fisher-Yates com CSPRNG para permutação uniforme
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}
