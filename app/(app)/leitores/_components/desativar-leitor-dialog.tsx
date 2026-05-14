"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeitorComContadores } from "models/leitores";

interface DesativarLeitorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leitor: LeitorComContadores | undefined;
}

export function DesativarLeitorDialog({
  open,
  onClose,
  onSuccess,
  leitor,
}: DesativarLeitorDialogProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setErro(null);
    onClose();
  }

  async function confirmar() {
    if (!leitor) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/v1/leitores/${leitor.id}/desativar`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao desativar leitor.");
        return;
      }
      onSuccess();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar leitor</DialogTitle>
          <DialogDescription>
            Desativar <strong>{leitor?.nome}</strong>? O leitor não aparecerá
            mais nas buscas e não poderá fazer novos empréstimos.
          </DialogDescription>
        </DialogHeader>

        {erro && (
          <p className="text-sm text-red-600" role="alert">
            {erro}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={salvando || !leitor}
            aria-label={
              leitor ? `Confirmar desativação de ${leitor.nome}` : undefined
            }
          >
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
