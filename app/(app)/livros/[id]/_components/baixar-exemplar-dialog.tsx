"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExemplarComLeitor } from "models/exemplares";

interface Props {
  exemplar: ExemplarComLeitor;
}

const MOTIVOS = [
  { value: "Perdido", label: "Perdido" },
  { value: "Danificado", label: "Danificado" },
  { value: "Descartado", label: "Descartado" },
  { value: "Outro", label: "Outro" },
] as const;

export function BaixarExemplarDialog({ exemplar }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setMotivo("");
      setErro(null);
    }
  }

  async function confirmar() {
    if (!motivo) return;
    setErro(null);
    setBaixando(true);
    try {
      const res = await fetch(`/api/v1/exemplares/${exemplar.id}/baixar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });

      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao baixar exemplar.");
        return;
      }

      router.refresh();
      setOpen(false);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-gray-400 hover:text-red-600"
        onClick={() => setOpen(true)}
      >
        Baixar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixar exemplar</DialogTitle>
            <DialogDescription>
              Tombamento:{" "}
              <strong className="font-mono">{exemplar.codigoTombamento}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo-trigger">
                Motivo da baixa{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger id="motivo-trigger" className="w-full">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <TriangleAlert
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                aria-hidden="true"
              />
              <span>Tem certeza? Esta ação não pode ser desfeita.</span>
            </div>

            {erro && (
              <p className="text-sm text-red-600" role="alert">
                {erro}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={baixando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmar}
              disabled={!motivo || baixando}
            >
              {baixando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
