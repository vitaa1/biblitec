"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { LeitorComContadores } from "models/leitores";

interface LeitorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  girotecaId: string;
  leitor?: LeitorComContadores;
}

interface FormState {
  nome: string;
  tipo: "aluno" | "professor" | "funcionario";
  matricula: string;
  turma: string;
  telefone: string;
  responsavel: string;
}

const FORM_VAZIO: FormState = {
  nome: "",
  tipo: "aluno",
  matricula: "",
  turma: "",
  telefone: "",
  responsavel: "",
};

function leitorParaForm(leitor: LeitorComContadores): FormState {
  return {
    nome: leitor.nome,
    tipo: leitor.tipo as FormState["tipo"],
    matricula: leitor.matricula ?? "",
    turma: leitor.turma ?? "",
    telefone: leitor.telefone ?? "",
    responsavel: leitor.responsavel ?? "",
  };
}

export function LeitorDialog({
  open,
  onClose,
  onSuccess,
  girotecaId,
  leitor,
}: LeitorDialogProps) {
  const modoEdicao = Boolean(leitor);
  const [form, setForm] = useState<FormState>(
    leitor ? leitorParaForm(leitor) : FORM_VAZIO,
  );
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroMatricula, setErroMatricula] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(leitor ? leitorParaForm(leitor) : FORM_VAZIO);
      setErroGeral(null);
      setErroMatricula(null);
    }
  }, [open, leitor]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErroGeral(null);
    if (field === "matricula") setErroMatricula(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;

    setErroGeral(null);
    setErroMatricula(null);
    setSalvando(true);

    try {
      const payload = modoEdicao
        ? {
            nome: form.nome.trim() || undefined,
            tipo: form.tipo || undefined,
            matricula: form.matricula.trim() || null,
            turma: form.turma.trim() || null,
            telefone: form.telefone.trim() || null,
            responsavel: form.responsavel.trim() || null,
          }
        : {
            girotecaId,
            nome: form.nome.trim(),
            tipo: form.tipo,
            matricula: form.matricula.trim() || undefined,
            turma: form.turma.trim() || undefined,
            telefone: form.telefone.trim() || undefined,
            responsavel: form.responsavel.trim() || undefined,
          };

      const url = modoEdicao
        ? `/api/v1/leitores/${leitor!.id}`
        : "/api/v1/leitores";
      const method = modoEdicao ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        if (body.code === "MATRICULA_DUPLICADA") {
          setErroMatricula("Já existe um leitor com esta matrícula nesta giroteca.");
        } else {
          setErroGeral(body.error ?? "Erro ao salvar leitor.");
        }
        return;
      }

      onSuccess();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const podeConfirmar = Boolean(form.nome.trim()) && !salvando;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modoEdicao ? "Editar leitor" : "Novo leitor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="leitor-nome">
              Nome{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id="leitor-nome"
              value={form.nome}
              onChange={(e) => setField("nome", e.target.value)}
              placeholder="Ex: Ana Lúcia"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leitor-tipo">Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) =>
                setField("tipo", v as FormState["tipo"])
              }
            >
              <SelectTrigger id="leitor-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aluno">Aluno</SelectItem>
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="funcionario">Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leitor-matricula">Matrícula</Label>
            <Input
              id="leitor-matricula"
              value={form.matricula}
              onChange={(e) => setField("matricula", e.target.value)}
              placeholder="Opcional"
              aria-invalid={!!erroMatricula}
              aria-describedby={erroMatricula ? "leitor-matricula-erro" : undefined}
            />
            {erroMatricula && (
              <p
                id="leitor-matricula-erro"
                className="text-sm text-red-600"
                role="alert"
              >
                {erroMatricula}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leitor-turma">Turma</Label>
            <Input
              id="leitor-turma"
              value={form.turma}
              onChange={(e) => setField("turma", e.target.value)}
              placeholder="Ex: 5A"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leitor-telefone">Telefone</Label>
            <Input
              id="leitor-telefone"
              value={form.telefone}
              onChange={(e) => setField("telefone", e.target.value)}
              placeholder="Ex: (86) 99999-0000"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leitor-responsavel">Responsável</Label>
            <Input
              id="leitor-responsavel"
              value={form.responsavel}
              onChange={(e) => setField("responsavel", e.target.value)}
              placeholder="Nome do responsável (opcional)"
            />
          </div>

          {erroGeral && (
            <p className="text-sm text-red-600" role="alert">
              {erroGeral}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeConfirmar}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {modoEdicao ? "Salvar alterações" : "Criar leitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
