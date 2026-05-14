"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeitorComContadores } from "models/leitores";

interface RespostaApi {
  leitores: LeitorComContadores[];
  total: number;
  page: number;
  totalPages: number;
}

interface LeitorListProps {
  initialData: RespostaApi;
  onNovoLeitor?: () => void;
  onEditar?: (leitor: LeitorComContadores) => void;
  onDesativar?: (leitor: LeitorComContadores) => void;
}

const TIPO_LABEL: Record<string, string> = {
  aluno: "Aluno",
  professor: "Professor",
  funcionario: "Funcionário",
};

export function LeitorList({
  initialData,
  onNovoLeitor,
  onEditar,
  onDesativar,
}: LeitorListProps) {
  const [dados, setDados] = useState<RespostaApi>(initialData);
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMounted = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeitores = useCallback(async (q: string, paginaAtiva: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCarregando(true);
    setErro(null);

    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("page", String(paginaAtiva));

      const res = await fetch(`/api/v1/leitores?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        setErro("Erro ao carregar leitores. Tente novamente.");
        return;
      }

      const json: RespostaApi = await res.json();
      setDados(json);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setErro("Erro ao carregar leitores. Tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    fetchLeitores(busca, page);
  }, [busca, page, fetchLeitores]);

  const handleBusca = useCallback(
    (valor: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setBusca(valor);
        setPage(1);
      }, 300);
    },
    [],
  );

  const recarregar = useCallback(() => {
    fetchLeitores(busca, page);
  }, [busca, page, fetchLeitores]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leitores</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie os leitores da giroteca
            </p>
          </div>
          <Button onClick={onNovoLeitor}>
            <Plus className="mr-2 h-4 w-4" />
            Novo leitor
          </Button>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou matrícula…"
              onChange={(e) => handleBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {carregando ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : erro ? (
            <div className="px-4 py-12 text-center text-sm text-red-600">
              {erro}
            </div>
          ) : dados.leitores.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {busca
                ? `Nenhum leitor encontrado para "${busca}".`
                : "Nenhum leitor cadastrado."}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Nome
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Tipo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Matrícula
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Turma
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Em aberto
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Atrasados
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {dados.leitores.map((leitor) => (
                  <tr key={leitor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {leitor.nome}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {TIPO_LABEL[leitor.tipo] ?? leitor.tipo}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className="font-mono text-sm text-gray-500">
                        {leitor.matricula ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {leitor.turma ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {leitor.emprestimosEmAberto > 0 ? (
                        <span className="text-sm font-medium text-amber-600">
                          {leitor.emprestimosEmAberto}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {leitor.emprestimosAtrasados > 0 ? (
                        <span className="text-sm font-medium text-red-600">
                          {leitor.emprestimosAtrasados}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditar?.(leitor)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => onDesativar?.(leitor)}
                        >
                          Desativar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {dados.total} leitor{dados.total === 1 ? "" : "es"} encontrado
            {dados.total === 1 ? "" : "s"}
          </p>
          {dados.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || carregando}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-gray-500">
                Página {dados.page} de {dados.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= dados.totalPages || carregando}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { LeitorListProps, RespostaApi };
