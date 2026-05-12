"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PasswordRevealModalProps {
  open: boolean;
  nomeUsuario: string;
  senha: string;
  onClose: () => void;
}

export function PasswordRevealModal({
  open,
  nomeUsuario,
  senha,
  onClose,
}: PasswordRevealModalProps) {
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);

  async function copiarSenha() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErroCopia(true);
      setTimeout(() => setErroCopia(false), 3000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha temporária gerada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A senha temporária de <strong>{nomeUsuario}</strong> foi gerada.
            Repasse-a agora.
          </p>

          {/* Gestalt - Figura-fundo: caixa com fundo diferenciado destaca a senha */}
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <p className="select-all text-center font-mono text-2xl font-bold tracking-widest text-amber-900">
              {senha}
            </p>
          </div>

          {/* Gestalt - Fechamento: aviso delimitado em área própria */}
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">
              ⚠ Guarde esta senha. Ela não será exibida novamente.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={copiarSenha}
            aria-label="Copiar senha temporária para a área de transferência"
          >
            {copiado
              ? "Copiado!"
              : erroCopia
                ? "Falha ao copiar"
                : "Copiar senha"}
          </Button>
          <Button
            onClick={onClose}
            aria-label="Fechar modal de senha temporária"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
