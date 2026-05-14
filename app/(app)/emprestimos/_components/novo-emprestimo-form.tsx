"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Search, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExemplarBuscado {
  exemplar: {
    id: string;
    codigoTombamento: string;
    status: "disponivel" | "emprestado" | "baixado";
  };
  livro: { titulo: string; autores: string; capaUrl: string | null };
  leitorAtual?: { nome: string; turma: string | null; dataEmprestimo: string };
}

interface LeitorResumo {
  id: string;
  nome: string;
  matricula: string | null;
  turma: string | null;
  tipo: string;
}

const TIPO_LABEL: Record<string, string> = {
  aluno: "Aluno",
  professor: "Professor",
  funcionario: "Funcionário",
};

const ERROS_CODE: Record<string, string> = {
  EXEMPLAR_INDISPONIVEL:
    "Este exemplar foi emprestado por outro usuário. Recarregue a página.",
  LEITOR_INATIVO: "Este leitor está desativado. Fale com o administrador.",
  LEITOR_LIMITE_ATINGIDO:
    "Este leitor já tem 3 empréstimos em aberto. É necessário devolver um antes.",
  LEITOR_COM_ATRASO:
    "Este leitor tem empréstimos em atraso. Registre a devolução antes de novo empréstimo.",
};

function dataPadrao14Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function dataLimiteMax(): string {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

function dataHoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NovoEmprestimoForm() {
  const [buscaExemplar, setBuscaExemplar] = useState("");
  const [exemplar, setExemplar] = useState<ExemplarBuscado | null>(null);
  const [exemplarNaoEncontrado, setExemplarNaoEncontrado] = useState(false);
  const [buscandoExemplar, setBuscandoExemplar] = useState(false);

  const [buscaLeitor, setBuscaLeitor] = useState("");
  const [leitoresEncontrados, setLeitoresEncontrados] = useState<
    LeitorResumo[]
  >([]);
  const [leitorSelecionado, setLeitorSelecionado] =
    useState<LeitorResumo | null>(null);
  const [buscandoLeitor, setBuscandoLeitor] = useState(false);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  const [dataPrevista, setDataPrevista] = useState(dataPadrao14Dias);
  const [observacoes, setObservacoes] = useState("");
  const [observacoesAberto, setObservacoesAberto] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const refExemplar = useRef<HTMLInputElement>(null);
  const debounceExemplar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceLeitor = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortExemplar = useRef<AbortController | null>(null);
  const abortLeitor = useRef<AbortController | null>(null);

  useEffect(() => {
    refExemplar.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceExemplar.current) clearTimeout(debounceExemplar.current);
    if (!buscaExemplar.trim()) return;
    debounceExemplar.current = setTimeout(async () => {
      abortExemplar.current?.abort();
      const controller = new AbortController();
      abortExemplar.current = controller;
      setBuscandoExemplar(true);
      try {
        const res = await fetch(
          `/api/v1/exemplares/buscar?q=${encodeURIComponent(buscaExemplar.trim())}`,
          { signal: controller.signal },
        );
        if (res.status === 404) {
          setExemplar(null);
          setExemplarNaoEncontrado(true);
        } else if (res.ok) {
          const data: ExemplarBuscado = await res.json();
          setExemplar(data);
          setExemplarNaoEncontrado(false);
        } else {
          setExemplar(null);
          setExemplarNaoEncontrado(false);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setExemplar(null);
        }
      } finally {
        setBuscandoExemplar(false);
      }
    }, 300);
    return () => {
      if (debounceExemplar.current) clearTimeout(debounceExemplar.current);
    };
  }, [buscaExemplar]);

  useEffect(() => {
    if (debounceLeitor.current) clearTimeout(debounceLeitor.current);
    if (leitorSelecionado || !buscaLeitor.trim()) return;
    debounceLeitor.current = setTimeout(async () => {
      abortLeitor.current?.abort();
      const controller = new AbortController();
      abortLeitor.current = controller;
      setBuscandoLeitor(true);
      try {
        const res = await fetch(
          `/api/v1/leitores?q=${encodeURIComponent(buscaLeitor.trim())}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          const lista: LeitorResumo[] = (data.leitores ?? []).slice(0, 8);
          setLeitoresEncontrados(lista);
          setMostrarDropdown(true);
          const termo = buscaLeitor.trim();
          if (lista.length === 1 && lista[0].matricula === termo) {
            setLeitorSelecionado(lista[0]);
            setMostrarDropdown(false);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLeitoresEncontrados([]);
        }
      } finally {
        setBuscandoLeitor(false);
      }
    }, 300);
    return () => {
      if (debounceLeitor.current) clearTimeout(debounceLeitor.current);
    };
  }, [buscaLeitor, leitorSelecionado]);

  function selecionarLeitor(l: LeitorResumo) {
    setLeitorSelecionado(l);
    setBuscaLeitor(l.nome);
    setMostrarDropdown(false);
  }

  function limparLeitor() {
    setLeitorSelecionado(null);
    setBuscaLeitor("");
    setLeitoresEncontrados([]);
  }

  function resetar() {
    setBuscaExemplar("");
    setExemplar(null);
    setExemplarNaoEncontrado(false);
    setBuscaLeitor("");
    setLeitoresEncontrados([]);
    setLeitorSelecionado(null);
    setDataPrevista(dataPadrao14Dias());
    setObservacoes("");
    setObservacoesAberto(false);
    setErroGeral(null);
    refExemplar.current?.focus();
  }

  const podeConfirmar =
    !!exemplar &&
    exemplar.exemplar.status === "disponivel" &&
    !!leitorSelecionado &&
    !!dataPrevista &&
    !salvando;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!podeConfirmar || !exemplar || !leitorSelecionado) return;

    setErroGeral(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/v1/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exemplarId: exemplar.exemplar.id,
          leitorId: leitorSelecionado.id,
          dataPrevistaDevolucao: dataPrevista,
          observacoes: observacoes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        const msg =
          (body.code && ERROS_CODE[body.code as string]) ??
          (body.error as string) ??
          "Erro ao registrar empréstimo.";
        setErroGeral(msg);
        return;
      }
      toast.success(`Empréstimo registrado para ${leitorSelecionado.nome}.`);
      resetar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Novo empréstimo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Busque o exemplar pelo tombamento ou ISBN, depois o leitor
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          noValidate
        >
          {/* Campo 1 - Exemplar */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-exemplar">
              Código de tombamento ou ISBN{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={refExemplar}
                id="campo-exemplar"
                className="pl-9"
                value={buscaExemplar}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuscaExemplar(val);
                  if (!val.trim()) {
                    setExemplar(null);
                    setExemplarNaoEncontrado(false);
                  }
                }}
                placeholder="Ex: T-001 ou 9788535910663"
                autoComplete="off"
              />
            </div>
            {buscandoExemplar && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </p>
            )}
            {exemplar && exemplar.exemplar.status === "disponivel" && (
              <div className="flex gap-3 rounded-md border border-green-200 bg-green-50 p-3">
                <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded shadow-sm">
                  {exemplar.livro.capaUrl ? (
                    <Image
                      src={exemplar.livro.capaUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">
                    {exemplar.livro.titulo}
                  </p>
                  <p className="truncate text-sm text-gray-600">
                    {exemplar.livro.autores}
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-500">
                    {exemplar.exemplar.codigoTombamento}
                  </p>
                </div>
              </div>
            )}
            {exemplar && exemplar.exemplar.status !== "disponivel" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {exemplar.leitorAtual ? (
                    <>
                      Este exemplar está emprestado para{" "}
                      <strong>{exemplar.leitorAtual.nome}</strong>
                      {exemplar.leitorAtual.turma
                        ? `, turma ${exemplar.leitorAtual.turma}`
                        : ""}
                      , desde{" "}
                      {new Date(
                        exemplar.leitorAtual.dataEmprestimo,
                      ).toLocaleDateString("pt-BR")}
                      .
                    </>
                  ) : (
                    `Exemplar com status ${exemplar.exemplar.status}.`
                  )}
                </span>
              </div>
            )}
            {exemplarNaoEncontrado && !buscandoExemplar && (
              <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                Nenhum exemplar encontrado para{" "}
                <code className="font-mono">{buscaExemplar}</code>.
              </p>
            )}
          </div>

          {/* Campo 2 - Leitor */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-leitor">
              Leitor (matrícula ou nome){" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="campo-leitor"
                className="pl-9"
                value={buscaLeitor}
                onChange={(e) => {
                  const val = e.target.value;
                  setBuscaLeitor(val);
                  if (leitorSelecionado) setLeitorSelecionado(null);
                  if (!val.trim()) setLeitoresEncontrados([]);
                }}
                placeholder="Ex: Ana Lúcia ou MAT-001"
                autoComplete="off"
              />
              {leitorSelecionado && (
                <button
                  type="button"
                  onClick={limparLeitor}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:underline"
                >
                  Trocar
                </button>
              )}
              {mostrarDropdown &&
                !leitorSelecionado &&
                leitoresEncontrados.length > 0 && (
                  <ul
                    className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
                    role="listbox"
                  >
                    {leitoresEncontrados.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => selecionarLeitor(l)}
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">
                            {l.nome}
                          </span>
                          <span className="text-xs text-gray-500">
                            {TIPO_LABEL[l.tipo] ?? l.tipo}
                            {l.turma ? ` · ${l.turma}` : ""}
                            {l.matricula ? ` · ${l.matricula}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            {buscandoLeitor && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </p>
            )}
            {leitorSelecionado && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-semibold text-gray-900">
                  {leitorSelecionado.nome}
                </p>
                <p className="text-xs text-gray-600">
                  {TIPO_LABEL[leitorSelecionado.tipo] ?? leitorSelecionado.tipo}
                  {leitorSelecionado.turma
                    ? ` · ${leitorSelecionado.turma}`
                    : ""}
                  {leitorSelecionado.matricula
                    ? ` · ${leitorSelecionado.matricula}`
                    : ""}
                </p>
              </div>
            )}
          </div>

          {/* Campo 3 - Data */}
          <div className="space-y-1.5">
            <Label htmlFor="campo-data">Data prevista de devolução</Label>
            <Input
              id="campo-data"
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              min={dataHoje()}
              max={dataLimiteMax()}
            />
          </div>

          {/* Observações */}
          <details
            open={observacoesAberto}
            onToggle={(e) =>
              setObservacoesAberto((e.target as HTMLDetailsElement).open)
            }
          >
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
              Observações (opcional)
            </summary>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Notas sobre o empréstimo (até 500 caracteres)"
            />
          </details>

          {erroGeral && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {erroGeral}
            </p>
          )}

          <Button
            type="submit"
            disabled={!podeConfirmar}
            className="w-full bg-green-600 py-6 text-base hover:bg-green-700"
          >
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar empréstimo
          </Button>
        </form>
      </div>
    </div>
  );
}
