"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EmprestimoListagem } from "models/emprestimos";
import { calcularNovaDataPrevista, formatarData } from "lib/emprestimos";
import { DIAS_PRAZO, MAX_RENOVACOES } from "lib/emprestimos-config";

interface RenovarDialogProps {
  emprestimo: EmprestimoListagem;
  onClose: () => void;
  onRenovado: () => void;
}

export function RenovarDialog({
  emprestimo,
  onClose,
  onRenovado,
}: RenovarDialogProps) {
  const [renovando, setRenovando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Erros de negócio (409) são permanentes — impedir nova tentativa
  const [erroPermanente, setErroPermanente] = useState(false);

  const dataAtualStr = emprestimo.dataPrevistaDevolucao.toISOString();
  const novaData = calcularNovaDataPrevista(dataAtualStr);

  async function handleRenovar() {
    setRenovando(true);
    setErro(null);
    setErroPermanente(false);
    try {
      const res = await fetch(`/api/v1/emprestimos/${emprestimo.id}/renovar`, {
        method: "POST",
      });
      if (res.ok) {
        onRenovado();
      } else {
        const body = await res.json().catch(() => ({}));
        setErro(
          body.message ??
            body.error ??
            "Não foi possível renovar. Tente novamente.",
        );
        if (res.status === 409) setErroPermanente(true);
      }
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setRenovando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar empréstimo</DialogTitle>
          <DialogDescription>
            O empréstimo de <strong>{emprestimo.leitor.nome}</strong> será
            renovado por mais {DIAS_PRAZO} dias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-md bg-gray-50 px-4 py-3 text-sm">
          <p className="text-gray-600">
            <span className="font-medium">Livro:</span>{" "}
            {emprestimo.livro.titulo}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Data atual:</span>{" "}
            {formatarData(dataAtualStr)}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Nova data:</span>{" "}
            <span className="font-semibold text-gray-900">
              {formatarData(novaData)}
            </span>
          </p>
        </div>

        <p className="text-xs text-gray-500">
          Esta será a {emprestimo.renovacoes + 1}ª renovação de {MAX_RENOVACOES}{" "}
          permitidas.
        </p>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={renovando}>
            Cancelar
          </Button>
          {!erroPermanente && (
            <Button onClick={handleRenovar} disabled={renovando}>
              {renovando ? "Renovando..." : "Renovar empréstimo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
