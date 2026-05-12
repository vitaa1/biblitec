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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Papel, Usuario } from "../types";
import { girotecasDisponiveis } from "../mock-users";

interface NovoUsuarioForm {
  nome: string;
  email: string;
  papel: Papel | "";
  girotecaVinculada: string;
}

const FORM_VAZIO: NovoUsuarioForm = {
  nome: "",
  email: "",
  papel: "",
  girotecaVinculada: "",
};

interface NewUserDialogProps {
  open: boolean;
  emailsExistentes: string[];
  onCriar: (dados: Omit<Usuario, "id" | "status">) => void;
  onCancelar: () => void;
}

export function NewUserDialog({
  open,
  emailsExistentes,
  onCriar,
  onCancelar,
}: NewUserDialogProps) {
  const [form, setForm] = useState<NovoUsuarioForm>(FORM_VAZIO);
  const [erroEmail, setErroEmail] = useState("");

  function fechar() {
    setForm(FORM_VAZIO);
    setErroEmail("");
    onCancelar();
  }

  function validarEmail(email: string) {
    if (emailsExistentes.includes(email.toLowerCase())) {
      setErroEmail("Já existe um usuário com este e-mail");
    } else {
      setErroEmail("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.papel || erroEmail) return;

    onCriar({
      nome: form.nome,
      email: form.email.toLowerCase(),
      papel: form.papel as Papel,
      ...(form.papel === "gestor" && form.girotecaVinculada
        ? { girotecaVinculada: form.girotecaVinculada }
        : {}),
    });

    setForm(FORM_VAZIO);
    setErroEmail("");
  }

  const podeConfirmar =
    Boolean(form.nome.trim()) &&
    Boolean(form.email.trim()) &&
    Boolean(form.papel) &&
    !erroEmail &&
    (form.papel !== "gestor" || Boolean(form.girotecaVinculada));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Gestalt - Proximidade: label + input como unidade visual coesa */}
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Ana Cristina Melo"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                validarEmail(e.target.value);
              }}
              placeholder="Ex: ana.melo@nthe.pi.gov.br"
              required
              aria-describedby={erroEmail ? "email-error" : undefined}
              aria-invalid={!!erroEmail}
            />
            {erroEmail && (
              <p id="email-error" className="text-sm text-red-600" role="alert">
                {erroEmail}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="papel">Papel</Label>
            <Select
              value={form.papel}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  papel: v as Papel,
                  girotecaVinculada: "",
                }))
              }
            >
              <SelectTrigger
                id="papel"
                aria-label="Selecionar papel do usuário"
              >
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin_nthe">Administrador</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="usuario">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo condicional — só exibe quando papel = gestor */}
          {form.papel === "gestor" && (
            <div className="space-y-1.5">
              <Label htmlFor="giroteca">Giroteca vinculada</Label>
              <Select
                value={form.girotecaVinculada}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, girotecaVinculada: v }))
                }
              >
                <SelectTrigger
                  id="giroteca"
                  aria-label="Selecionar giroteca vinculada"
                >
                  <SelectValue placeholder="Selecione uma giroteca" />
                </SelectTrigger>
                <SelectContent>
                  {girotecasDisponiveis.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!podeConfirmar}
              aria-label="Confirmar criação de novo usuário"
            >
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
