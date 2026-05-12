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
  const [erroNome, setErroNome] = useState("");
  const [erroEmail, setErroEmail] = useState("");

  function fechar() {
    setForm(FORM_VAZIO);
    setErroNome("");
    setErroEmail("");
    onCancelar();
  }

  function validarNome(nome: string) {
    const palavras = nome.trim().split(/\s+/).filter(Boolean);
    if (palavras.length < 2) {
      setErroNome("Informe o nome completo (nome e sobrenome)");
    } else if (!/^[\p{L}\s'-]+$/u.test(nome.trim())) {
      setErroNome("O nome não pode conter números ou símbolos");
    } else {
      setErroNome("");
    }
  }

  function validarEmail(email: string) {
    const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!formatoValido) {
      setErroEmail("Informe um e-mail válido (ex: nome@dominio.com)");
    } else if (emailsExistentes.includes(email.toLowerCase())) {
      setErroEmail("Já existe um usuário com este e-mail");
    } else {
      setErroEmail("");
    }
  }

  function handleEmailBlur(email: string) {
    if (email.trim()) validarEmail(email);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.papel || erroNome || erroEmail)
      return;

    onCriar({
      nome: form.nome.trim(),
      email: form.email.toLowerCase(),
      papel: form.papel as Papel,
      ...(form.papel === "gestor_giroteca" && form.girotecaVinculada
        ? { girotecaVinculada: form.girotecaVinculada }
        : {}),
    });

    setForm(FORM_VAZIO);
    setErroNome("");
    setErroEmail("");
  }

  const podeConfirmar =
    Boolean(form.nome.trim()) &&
    !erroNome &&
    Boolean(form.email.trim()) &&
    Boolean(form.papel) &&
    !erroEmail &&
    (form.papel !== "gestor_giroteca" || Boolean(form.girotecaVinculada));

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
              onChange={(e) => {
                setForm((f) => ({ ...f, nome: e.target.value }));
                if (erroNome) validarNome(e.target.value);
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) validarNome(e.target.value);
              }}
              placeholder="Ex: Ana Cristina Melo"
              required
              autoFocus
              aria-describedby={erroNome ? "nome-error" : undefined}
              aria-invalid={!!erroNome}
            />
            {erroNome && (
              <p id="nome-error" className="text-sm text-red-600" role="alert">
                {erroNome}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                if (erroEmail) validarEmail(e.target.value);
              }}
              onBlur={(e) => handleEmailBlur(e.target.value)}
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
                <SelectItem value="gestor_giroteca">Gestor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo condicional — só exibe quando papel = gestor */}
          {form.papel === "gestor_giroteca" && (
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
