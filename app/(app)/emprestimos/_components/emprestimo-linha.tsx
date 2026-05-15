"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmprestimoListagem } from "models/emprestimos";
import { calcularDiasAtraso, formatarData } from "lib/emprestimos";
import { MAX_RENOVACOES } from "lib/emprestimos-config";

interface EmprestimoLinhaProps {
  emprestimo: EmprestimoListagem;
  mostrarBotoes: boolean;
  onDevolvido: () => void;
  onRenovar: () => void;
}

export function EmprestimoLinha({
  emprestimo,
  mostrarBotoes,
  onDevolvido,
  onRenovar,
}: EmprestimoLinhaProps) {
  const [devolvendo, setDevolvendo] = useState(false);
  const [erroDevolucao, setErroDevolucao] = useState<string | null>(null);

  const dataPrevistoStr = emprestimo.dataPrevistaDevolucao.toISOString();
  const diasAtraso = calcularDiasAtraso(dataPrevistoStr);
  const atrasado = diasAtraso > 0;

  async function handleDevolver() {
    setDevolvendo(true);
    setErroDevolucao(null);
    try {
      const res = await fetch(`/api/v1/loans/${emprestimo.id}`, {
        method: "PATCH",
      });
      if (res.ok) {
        onDevolvido();
      } else {
        const body = await res.json().catch(() => ({}));
        setErroDevolucao(
          body.error ??
            "Não foi possível registrar a devolução. Tente novamente.",
        );
      }
    } catch {
      setErroDevolucao("Erro de conexão. Tente novamente.");
    } finally {
      setDevolvendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Leitor */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {emprestimo.leitor.nome}
        </p>
        <p className="text-xs text-gray-500">
          {emprestimo.leitor.turma ?? "—"}
          {emprestimo.leitor.matricula && ` · ${emprestimo.leitor.matricula}`}
        </p>
      </div>

      {/* Livro */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-700">
          {emprestimo.livro.titulo}
        </p>
        <p className="text-xs text-gray-400">
          {emprestimo.exemplar.codigoTombamento}
        </p>
      </div>

      {/* Datas */}
      <div className="shrink-0 text-right text-xs text-gray-500">
        {emprestimo.dataDevolucao ? (
          <span>
            Devolvido em {formatarData(emprestimo.dataDevolucao.toISOString())}
          </span>
        ) : (
          <span className={atrasado ? "font-medium text-red-600" : ""}>
            {atrasado ? (
              <>
                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                {diasAtraso} dia{diasAtraso !== 1 ? "s" : ""} em atraso
              </>
            ) : (
              `Vence ${formatarData(dataPrevistoStr)}`
            )}
          </span>
        )}
      </div>

      {/* Botões */}
      {mostrarBotoes && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={devolvendo}
              onClick={handleDevolver}
            >
              {devolvendo ? "Devolvendo..." : "Devolver"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={atrasado || emprestimo.renovacoes >= MAX_RENOVACOES}
              title={
                atrasado
                  ? "Empréstimos em atraso não podem ser renovados"
                  : emprestimo.renovacoes >= MAX_RENOVACOES
                    ? "Já renovado o máximo de vezes"
                    : undefined
              }
              onClick={onRenovar}
            >
              Renovar
            </Button>
          </div>
          {erroDevolucao && (
            <p role="alert" className="text-xs text-red-600">
              {erroDevolucao}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
