"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeactivateDialogProps {
  open: boolean;
  nomeUsuario: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function DeactivateDialog({
  open,
  nomeUsuario,
  onConfirmar,
  onCancelar,
}: DeactivateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar usuário</DialogTitle>
          <DialogDescription>
            Desativar <strong>{nomeUsuario}</strong>? Ele perderá acesso ao
            sistema.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancelar}
            aria-label="Cancelar desativação de usuário"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmar}
            aria-label={`Confirmar desativação de ${nomeUsuario}`}
          >
            Desativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
