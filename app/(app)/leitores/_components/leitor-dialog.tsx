"use client";

import { useState } from "react";
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

type Erros = Partial<Record<keyof FormState | "geral", string>>;

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

// Aplica máscara brasileira progressiva: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX
function formatarTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface FormProps {
  onClose: () => void;
  onSuccess: () => void;
  girotecaId: string;
  leitor?: LeitorComContadores;
}

function LeitorForm({ onClose, onSuccess, girotecaId, leitor }: FormProps) {
  const modoEdicao = Boolean(leitor);
  const [form, setFormState] = useState<FormState>(
    leitor ? leitorParaForm(leitor) : FORM_VAZIO,
  );
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormState((f) => ({ ...f, [field]: value }));
    setErros((e) => ({ ...e, [field]: undefined, geral: undefined }));
  }

  function validar(): Erros {
    const e: Erros = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório.";
    if (form.matricula.length > 50)
      e.matricula = "Matrícula deve ter no máximo 50 caracteres.";
    if (form.turma.length > 100)
      e.turma = "Turma deve ter no máximo 100 caracteres.";
    if (form.responsavel.length > 255)
      e.responsavel = "Responsável deve ter no máximo 255 caracteres.";
    const digitos = form.telefone.replace(/\D/g, "");
    if (digitos.length > 0 && digitos.length < 10)
      e.telefone = "Telefone incompleto. Ex: (86) 99999-0000";
    return e;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errosValidacao = validar();
    if (Object.keys(errosValidacao).length > 0) {
      setErros(errosValidacao);
      return;
    }

    setErros({});
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
          setErros({
            matricula: "Já existe um leitor com esta matrícula nesta giroteca.",
          });
        } else {
          setErros({ geral: body.error ?? "Erro ao salvar leitor." });
        }
        return;
      }

      onSuccess();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  const temErros = Object.values(erros).some(Boolean);
  const podeConfirmar = Boolean(form.nome.trim()) && !salvando && !temErros;

  return (
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
          maxLength={255}
          required
          autoFocus
          aria-invalid={!!erros.nome}
          aria-describedby={erros.nome ? "leitor-nome-erro" : undefined}
        />
        {erros.nome && (
          <p
            id="leitor-nome-erro"
            className="text-sm text-red-600"
            role="alert"
          >
            {erros.nome}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="leitor-tipo">Tipo</Label>
        <Select
          value={form.tipo}
          onValueChange={(v) => setField("tipo", v as FormState["tipo"])}
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
          maxLength={50}
          aria-invalid={!!erros.matricula}
          aria-describedby={
            erros.matricula ? "leitor-matricula-erro" : undefined
          }
        />
        {erros.matricula && (
          <p
            id="leitor-matricula-erro"
            className="text-sm text-red-600"
            role="alert"
          >
            {erros.matricula}
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
          maxLength={100}
          aria-invalid={!!erros.turma}
          aria-describedby={erros.turma ? "leitor-turma-erro" : undefined}
        />
        {erros.turma && (
          <p
            id="leitor-turma-erro"
            className="text-sm text-red-600"
            role="alert"
          >
            {erros.turma}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="leitor-telefone">Telefone</Label>
        <Input
          id="leitor-telefone"
          value={form.telefone}
          onChange={(e) =>
            setField("telefone", formatarTelefone(e.target.value))
          }
          placeholder="Ex: (86) 99999-0000"
          inputMode="tel"
          maxLength={15}
          aria-invalid={!!erros.telefone}
          aria-describedby={erros.telefone ? "leitor-telefone-erro" : undefined}
        />
        {erros.telefone && (
          <p
            id="leitor-telefone-erro"
            className="text-sm text-red-600"
            role="alert"
          >
            {erros.telefone}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="leitor-responsavel">Responsável</Label>
        <Input
          id="leitor-responsavel"
          value={form.responsavel}
          onChange={(e) => setField("responsavel", e.target.value)}
          placeholder="Nome do responsável (opcional)"
          maxLength={255}
          aria-invalid={!!erros.responsavel}
          aria-describedby={
            erros.responsavel ? "leitor-responsavel-erro" : undefined
          }
        />
        {erros.responsavel && (
          <p
            id="leitor-responsavel-erro"
            className="text-sm text-red-600"
            role="alert"
          >
            {erros.responsavel}
          </p>
        )}
      </div>

      {erros.geral && (
        <p className="text-sm text-red-600" role="alert">
          {erros.geral}
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
  );
}

export function LeitorDialog({
  open,
  onClose,
  onSuccess,
  girotecaId,
  leitor,
}: LeitorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{leitor ? "Editar leitor" : "Novo leitor"}</DialogTitle>
        </DialogHeader>

        <LeitorForm
          key={`${leitor?.id ?? "new"}-${String(open)}`}
          onClose={onClose}
          onSuccess={onSuccess}
          girotecaId={girotecaId}
          leitor={leitor}
        />
      </DialogContent>
    </Dialog>
  );
}
