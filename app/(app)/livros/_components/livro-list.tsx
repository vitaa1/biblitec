"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LivroComExemplares } from "models/livros";
import { LivroListItem } from "./livro-list-item";
import { LivroListSkeleton } from "./livro-list-skeleton";
import { LivroSearchInput } from "./livro-search-input";

interface RespostaApi {
  livros: LivroComExemplares[];
  total: number;
  page: number;
  totalPages: number;
}

interface LivroListProps {
  initialData: RespostaApi;
}

export function LivroList({ initialData }: LivroListProps) {
  const router = useRouter();
  const [dados, setDados] = useState<RespostaApi>(initialData);
  const [filtros, setFiltros] = useState<{ q?: string; isbn?: string }>({});
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMounted = useRef(false);

  const buscar = useCallback(
    async (filtrosAtivos: { q?: string; isbn?: string }, paginaAtiva: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCarregando(true);
      setErro(null);

      try {
        const params = new URLSearchParams();
        if (filtrosAtivos.q) params.set("q", filtrosAtivos.q);
        if (filtrosAtivos.isbn) params.set("isbn", filtrosAtivos.isbn);
        params.set("page", String(paginaAtiva));

        const res = await fetch(`/api/v1/livros?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          setErro("Erro ao carregar livros. Tente novamente.");
          return;
        }

        const json: RespostaApi = await res.json();
        setDados(json);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setErro("Erro ao carregar livros. Tente novamente.");
        }
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    buscar(filtros, page);
  }, [filtros, page, buscar]);

  function handleSearch(novosFiltros: { q?: string; isbn?: string }) {
    setFiltros(novosFiltros);
    setPage(1);
  }

  const termoBusca = filtros.q ?? filtros.isbn ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Localize livros pelo título, autor ou ISBN
          </p>
        </div>

        {/* Busca */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <LivroSearchInput onSearch={handleSearch} />
        </div>

        {/* Lista */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {carregando ? (
            <LivroListSkeleton />
          ) : erro ? (
            <div className="px-4 py-12 text-center text-sm text-red-600">
              {erro}
            </div>
          ) : dados.livros.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {termoBusca
                ? `Nenhum livro encontrado para "${termoBusca}".`
                : "Nenhum livro cadastrado."}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dados.livros.map((livro) => (
                <LivroListItem
                  key={livro.id}
                  livro={livro}
                  onClick={() => router.push(`/livros/${livro.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Paginação e contagem */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {dados.total} livro{dados.total === 1 ? "" : "s"} encontrado
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
