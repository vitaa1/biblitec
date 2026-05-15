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
import { Button } from "@/components/ui/button";
import type { EmprestimoListagem } from "models/emprestimos";
import { calcularNovaDataPrevista, formatarData } from "lib/emprestimos";
import { DIAS_PRAZO } from "lib/emprestimos-config";

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

  const dataAtualStr = emprestimo.dataPrevistaDevolucao.toString();
  const novaData = calcularNovaDataPrevista(dataAtualStr);

  async function handleRenovar() {
    setRenovando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/v1/loans/${emprestimo.id}/renovar`, {
        method: "POST",
      });
      if (res.ok) {
        onRenovado();
      } else {
        const body = await res.json().catch(() => ({}));
        setErro(body.error ?? "Não foi possível renovar. Tente novamente.");
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
          <DialogTitle>Confirmar renovação</DialogTitle>
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

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={renovando}>
            Cancelar
          </Button>
          <Button onClick={handleRenovar} disabled={renovando}>
            {renovando ? "Renovando..." : "Confirmar renovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
