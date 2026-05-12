type Entrada = {
  contagem: number;
  resetEm: number;
};

type RateLimiter = {
  bloqueado: (chave: string) => boolean;
  registrarFalha: (chave: string) => void;
  restantes: (chave: string) => number;
};

// Estado em memória por processo — não funciona com múltiplas réplicas.
export function criarRateLimiter(opcoes: {
  maxTentativas: number;
  janelaSeg: number;
}): RateLimiter {
  const { maxTentativas, janelaSeg } = opcoes;
  const mapa = new Map<string, Entrada>();

  function obter(chave: string): Entrada {
    const agora = Date.now();
    const entrada = mapa.get(chave);
    if (!entrada || agora >= entrada.resetEm) {
      const nova = { contagem: 0, resetEm: agora + janelaSeg * 1000 };
      mapa.set(chave, nova);
      return nova;
    }
    return entrada;
  }

  return {
    bloqueado(chave) {
      return obter(chave).contagem >= maxTentativas;
    },
    registrarFalha(chave) {
      const entrada = obter(chave);
      entrada.contagem++;
    },
    restantes(chave) {
      return Math.max(0, maxTentativas - obter(chave).contagem);
    },
  };
}
