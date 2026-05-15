import { MAX_RENOVACOES } from "lib/emprestimos-config";

export const EMPRESTIMOS_POR_PAGINA = 50;
export const HISTORICO_POR_PAGINA = 20;

export type EmprestimoParaUI = {
  id: string;
  leitor: { nome: string; turma: string | null; matricula: string | null };
  livro: { titulo: string };
  exemplar: { codigoTombamento: string };
  dataEmprestimo: string;
  dataPrevistaDevolucao: string;
  dataDevolucao: string | null;
  renovacoes: number;
};

// Compara datas UTC para evitar bug de fuso — vence hoje ainda não é atraso
export function calcularDiasAtraso(dataPrevistaDevolucao: string): number {
  const due = new Date(dataPrevistaDevolucao);
  const now = new Date();
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startOfDue = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  return Math.max(0, Math.floor((startOfToday - startOfDue) / 86_400_000));
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function canRenovar(e: EmprestimoParaUI): boolean {
  return (
    e.dataDevolucao === null &&
    e.renovacoes < MAX_RENOVACOES &&
    calcularDiasAtraso(e.dataPrevistaDevolucao) === 0
  );
}

export function calcularNovaDataPrevista(
  dataPrevistaDevolucao: string,
): string {
  const due = new Date(dataPrevistaDevolucao);
  due.setUTCDate(due.getUTCDate() + 14);
  return due.toISOString();
}
