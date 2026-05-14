"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmprestimoParaDevolucao = {
  emprestimoId: string;
  exemplar: { id: string; codigoTombamento: string; estado: string };
  livro: { titulo: string; autores: string; capaUrl: string | null };
  leitor: { nome: string; turma: string | null };
  dataEmprestimo: string;
  dataPrevistaDevolucao: string;
};

const ERROS_BUSCA: Record<string, string> = {
  SEM_EMPRESTIMO_ABERTO: "Este exemplar não está emprestado no momento.",
  MULTIPLOS_EMPRESTADOS:
    "Há mais de um exemplar deste livro emprestado. Use o código de tombamento.",
  EXEMPLAR_BAIXADO: "Este exemplar foi baixado do acervo.",
};

const MOTIVOS_BAIXA = [
  { value: "Perdido", label: "Perdido" },
  { value: "Danificado", label: "Danificado" },
  { value: "Descartado", label: "Descartado" },
  { value: "Outro", label: "Outro" },
] as const;

function calcularDiasAtraso(dataPrevistaDevolucao: string): number {
  return Math.floor(
    (Date.now() - new Date(dataPrevistaDevolucao).getTime()) / 86_400_000,
  );
}

export function DevolucaoForm() {
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<EmprestimoParaDevolucao | null>(
    null,
  );
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [estadoRetorno, setEstadoRetorno] = useState("");

  const [confirmando, setConfirmando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  const [mostrarDialogBaixa, setMostrarDialogBaixa] = useState(false);
  const [exemplarIdParaBaixa, setExemplarIdParaBaixa] = useState<string | null>(
    null,
  );
  const [motivoBaixa, setMotivoBaixa] = useState("Danificado");
  const [baixando, setBaixando] = useState(false);
  const [erroBaixa, setErroBaixa] = useState<string | null>(null);

  const refBusca = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    refBusca.current?.focus();
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!busca.trim()) {
      setResultado(null);
      setErroBusca(null);
      return;
    }
    setResultado(null);
    setErroBusca(null);
    debounce.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/v1/emprestimos/buscar-devolucao?q=${encodeURIComponent(busca.trim())}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data: EmprestimoParaDevolucao = await res.json();
          setResultado(data);
        } else {
          const body = await res.json().catch(() => ({}));
          const code = body.code as string | undefined;
          setErroBusca(
            (code && ERROS_BUSCA[code]) ??
              (body.error as string | undefined) ??
              "Nenhum exemplar com esse código foi encontrado nesta giroteca.",
          );
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setErroBusca("Sem conexão com o servidor. Tente novamente.");
        }
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [busca]);

  function resetar() {
    setBusca("");
    setResultado(null);
    setErroBusca(null);
    setEstadoRetorno("");
    setConfirmando(false);
    setErroConfirmacao(null);
    setMostrarDialogBaixa(false);
    setExemplarIdParaBaixa(null);
    setMotivoBaixa("Danificado");
    setErroBaixa(null);
    refBusca.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resultado || confirmando) return;
    setConfirmando(true);
    setErroConfirmacao(null);
    try {
      const body = estadoRetorno ? { estadoRetorno } : {};
      const res = await fetch(`/api/v1/loans/${resultado.emprestimoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErroConfirmacao(
          (data.error as string | undefined) ?? "Erro ao registrar devolução.",
        );
        return;
      }
      toast.success("Devolução registrada.");
      if (estadoRetorno === "danificado") {
        setExemplarIdParaBaixa(resultado.exemplar.id);
        setMostrarDialogBaixa(true);
      } else {
        resetar();
      }
    } finally {
      setConfirmando(false);
    }
  }

  async function confirmarBaixa() {
    if (!exemplarIdParaBaixa || baixando) return;
    setBaixando(true);
    setErroBaixa(null);
    try {
      const res = await fetch(
        `/api/v1/exemplares/${exemplarIdParaBaixa}/baixar`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivoBaixa }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErroBaixa(
          (data.error as string | undefined) ?? "Erro ao baixar exemplar.",
        );
        return;
      }
      toast.success("Exemplar baixado do acervo.");
      setMostrarDialogBaixa(false);
      resetar();
    } finally {
      setBaixando(false);
    }
  }

  const diasAtraso = resultado
    ? calcularDiasAtraso(resultado.dataPrevistaDevolucao)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Devolução</h1>
          <p className="mt-1 text-sm text-gray-500">
            Busque o exemplar pelo tombamento ou ISBN para registrar a devolução
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="campo-busca">Código de tombamento ou ISBN</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={refBusca}
                id="campo-busca"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: T-001 ou 9788535910663"
                autoComplete="off"
              />
            </div>
            {buscando && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </p>
            )}
            {erroBusca && !buscando && (
              <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                {erroBusca}
              </p>
            )}
          </div>

          {resultado && (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="flex gap-3 p-4">
                  <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded shadow-sm">
                    {resultado.livro.capaUrl ? (
                      <Image
                        src={resultado.livro.capaUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100">
                        <BookOpen className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {resultado.livro.titulo}
                    </p>
                    <p className="truncate text-sm text-gray-600">
                      {resultado.livro.autores}
                    </p>
                    <p className="mt-1 font-mono text-xs text-gray-500">
                      {resultado.exemplar.codigoTombamento}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="p-4">
                  <p className="font-semibold text-gray-900">
                    {resultado.leitor.nome}
                    {resultado.leitor.turma && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        · {resultado.leitor.turma}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Emprestado em{" "}
                    {new Date(resultado.dataEmprestimo).toLocaleDateString(
                      "pt-BR",
                    )}
                  </p>
                  {diasAtraso > 0 && (
                    <p className="mt-1 text-sm font-medium text-red-600">
                      ⚠ {diasAtraso} {diasAtraso === 1 ? "dia" : "dias"} em
                      atraso
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="estado-retorno-trigger"
                  className="text-sm text-gray-600"
                >
                  Estado na devolução (opcional)
                </Label>
                <Select
                  value={estadoRetorno || undefined}
                  onValueChange={setEstadoRetorno}
                >
                  <SelectTrigger id="estado-retorno-trigger" className="w-full">
                    <SelectValue placeholder="Não informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bom">Bom</SelectItem>
                    <SelectItem value="regular">Danificado leve</SelectItem>
                    <SelectItem value="danificado">Danificado grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {erroConfirmacao && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {erroConfirmacao}
            </p>
          )}

          <Button
            type="submit"
            disabled={!resultado || confirmando}
            className="w-full bg-blue-600 py-6 text-base hover:bg-blue-700"
          >
            {confirmando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar devolução
          </Button>
        </form>
      </div>

      <Dialog
        open={mostrarDialogBaixa}
        onOpenChange={(open) => {
          if (!open && !baixando) {
            setMostrarDialogBaixa(false);
            resetar();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deseja baixar este exemplar?</DialogTitle>
            <DialogDescription>
              O exemplar foi devolvido com estado Danificado grave. Você pode
              retirá-lo do acervo agora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo-baixa-trigger">
                Motivo da baixa{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select value={motivoBaixa} onValueChange={setMotivoBaixa}>
                <SelectTrigger id="motivo-baixa-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_BAIXA.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <span>Tem certeza? Esta ação não pode ser desfeita.</span>
            </div>
            {erroBaixa && (
              <p className="text-sm text-red-600" role="alert">
                {erroBaixa}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMostrarDialogBaixa(false);
                resetar();
              }}
              disabled={baixando}
            >
              Não, manter no acervo
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarBaixa}
              disabled={!motivoBaixa || baixando}
            >
              {baixando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
