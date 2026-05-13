"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface Props {
  girotecaId: string;
  nomeGiroteca: string;
}

export function DesativarGirotecaDialog({ girotecaId, nomeGiroteca }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setOpen(false);
    setErro(null);
  }

  async function confirmar() {
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(
        `/api/v1/admin/girotecas/${girotecaId}/desativar`,
        { method: "PATCH" },
      );
      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao desativar giroteca.");
        return;
      }
      router.refresh();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        aria-label={`Desativar giroteca ${nomeGiroteca}`}
      >
        Desativar
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar giroteca</DialogTitle>
            <DialogDescription>
              Desativar <strong>{nomeGiroteca}</strong>? Novos empréstimos serão
              bloqueados.
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
              disabled={salvando}
              aria-label={`Confirmar desativação de ${nomeGiroteca}`}
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
