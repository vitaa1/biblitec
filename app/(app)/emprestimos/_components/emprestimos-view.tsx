"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type {
  ResultadoListagem,
  ResultadoHistorico,
  EmprestimoListagem,
} from "models/emprestimos";
import { EmprestimoLinha } from "./emprestimo-linha";
import { RenovarDialog } from "./renovar-dialog";

type Aba = "em_aberto" | "atrasados" | "historico";

function parseDatesItem(raw: EmprestimoListagem): EmprestimoListagem {
  return {
    ...raw,
    dataEmprestimo: new Date(raw.dataEmprestimo),
    dataPrevistaDevolucao: new Date(raw.dataPrevistaDevolucao),
    dataDevolucao: raw.dataDevolucao ? new Date(raw.dataDevolucao) : null,
  };
}

interface EmprestimosViewProps {
  initialData: ResultadoListagem;
}

export function EmprestimosView({ initialData }: EmprestimosViewProps) {
  const [aba, setAba] = useState<Aba>("em_aberto");
  const [busca, setBusca] = useState("");
  const [turma, setTurma] = useState("");
  const [dados, setDados] = useState<ResultadoListagem>(initialData);
  const [dadosHistorico, setDadosHistorico] =
    useState<ResultadoHistorico | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [renovarEmprestimo, setRenovarEmprestimo] =
    useState<EmprestimoListagem | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const buscaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);
  const isFirstBuscaRender = useRef(true);

  const buscarDados = useCallback(
    async (abaAtiva: Aba, buscaAtiva: string, turmaAtiva: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);

      try {
        const params = new URLSearchParams({ aba: abaAtiva });
        if (buscaAtiva) params.set("busca", buscaAtiva);
        if (turmaAtiva) params.set("turma", turmaAtiva);

        const res = await fetch(`/api/v1/emprestimos?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;

        if (abaAtiva === "historico") {
          const json: ResultadoHistorico = await res.json();
          setDadosHistorico({
            ...json,
            items: json.items.map(parseDatesItem),
          });
        } else {
          const json: ResultadoListagem = await res.json();
          setDados({
            ...json,
            items: json.items.map(parseDatesItem),
          });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
        }
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  // Re-fetch when tab changes
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    buscarDados(aba, busca, turma);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, buscarDados]);

  // Debounce busca/turma changes
  useEffect(() => {
    if (isFirstBuscaRender.current) {
      isFirstBuscaRender.current = false;
      return;
    }
    if (buscaTimerRef.current) clearTimeout(buscaTimerRef.current);
    buscaTimerRef.current = setTimeout(() => {
      buscarDados(aba, busca, turma);
    }, 300);
    return () => {
      if (buscaTimerRef.current) clearTimeout(buscaTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, turma, buscarDados]);

  const recarregar = useCallback(() => {
    buscarDados(aba, busca, turma);
  }, [aba, busca, turma, buscarDados]);

  const items =
    aba === "historico" ? (dadosHistorico?.items ?? []) : dados.items;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Empréstimos</h1>
            <p className="mt-1 text-sm text-gray-500">
              {dados.totalEmAberto} em aberto
              {dados.totalAtrasados > 0 && (
                <span className="ml-2 font-medium text-red-600">
                  · {dados.totalAtrasados} em atraso
                </span>
              )}
            </p>
          </div>
          <Button asChild>
            <Link href="/emprestimos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo empréstimo
            </Link>
          </Button>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Buscar por nome ou matrícula..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="sm:max-w-xs"
          />
          <Input
            placeholder="Turma (ex: 5A)"
            value={turma}
            onChange={(e) => setTurma(e.target.value)}
            className="sm:max-w-[140px]"
          />
        </div>

        {/* Tabs */}
        <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
          <TabsList className="mb-4">
            <TabsTrigger value="em_aberto">
              Em aberto
              {dados.totalEmAberto > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                  {dados.totalEmAberto}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="atrasados">
              Atrasados
              {dados.totalAtrasados > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  {dados.totalAtrasados}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {(["em_aberto", "atrasados", "historico"] as const).map((v) => (
            <TabsContent key={v} value={v}>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {carregando && items.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-gray-400">
                    Carregando...
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-gray-500">
                    Nenhum empréstimo encontrado.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {items.map((emp) => (
                      <EmprestimoLinha
                        key={emp.id}
                        emprestimo={emp}
                        mostrarBotoes={v !== "historico"}
                        onDevolvido={recarregar}
                        onRenovar={() => setRenovarEmprestimo(emp)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {renovarEmprestimo && (
        <RenovarDialog
          emprestimo={renovarEmprestimo}
          onClose={() => setRenovarEmprestimo(null)}
          onRenovado={() => {
            setRenovarEmprestimo(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}
