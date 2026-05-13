"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";

interface Props {
  livroId: string;
  girotecaId: string;
}

const ESTADOS = [
  { value: "novo", label: "Novo" },
  { value: "bom", label: "Bom" },
  { value: "regular", label: "Regular" },
  { value: "danificado", label: "Danificado" },
] as const;

export function AdicionarExemplarDialog({ livroId, girotecaId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<"novo" | "bom" | "regular" | "danificado">("bom");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const codigoRef = useRef<HTMLInputElement>(null);

  const carregarSugestao = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/exemplares/proximo-codigo?girotecaId=${girotecaId}`,
      );
      if (res.ok) {
        const { proximo } = await res.json();
        setCodigo(proximo);
      }
    } catch {
      // silencioso — campo fica vazio para digitação manual
    }
  }, [girotecaId]);

  useEffect(() => {
    if (!open) return;
    carregarSugestao();
    const t = setTimeout(() => codigoRef.current?.select(), 80);
    return () => clearTimeout(t);
  }, [open, carregarSugestao]);

  function resetForm(novoCodigo?: string) {
    setCodigo(novoCodigo ?? "");
    setEstado("bom");
    setObservacoes("");
    setErro(null);
  }

  async function salvar(fecharApos: boolean) {
    if (!codigo.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/livros/${livroId}/exemplares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoTombamento: codigo.trim(),
          estado,
          observacoes: observacoes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao salvar exemplar.");
        return;
      }

      router.refresh();

      if (fecharApos) {
        setOpen(false);
        resetForm();
      } else {
        const n = parseInt(codigo.trim(), 10);
        const proxCodigo = !isNaN(n) ? String(n + 1) : "";
        resetForm(proxCodigo);
        if (!proxCodigo) await carregarSugestao();
        setTimeout(() => codigoRef.current?.select(), 80);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Adicionar exemplar
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar exemplar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="codigo-tombamento">
                Código de tombamento{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="codigo-tombamento"
                ref={codigoRef}
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setErro(null);
                }}
                placeholder="Ex: 001"
                aria-invalid={!!erro}
                aria-describedby={erro ? "exemplar-erro" : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estado-trigger">Estado</Label>
              <Select
                value={estado}
                onValueChange={(v) =>
                  setEstado(v as "novo" | "bom" | "regular" | "danificado")
                }
              >
                <SelectTrigger id="estado-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes-exemplar">Observações</Label>
              <Textarea
                id="observacoes-exemplar"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            {erro && (
              <p id="exemplar-erro" className="text-sm text-red-600" role="alert">
                {erro}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => salvar(false)}
              disabled={!codigo.trim() || salvando}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e adicionar outro
            </Button>
            <Button
              type="button"
              onClick={() => salvar(true)}
              disabled={!codigo.trim() || salvando}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
