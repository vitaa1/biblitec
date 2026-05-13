"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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

interface FormState {
  codigo: string;
  nome: string;
  escolaVinculada: string;
  endereco: string;
}

const FORM_VAZIO: FormState = {
  codigo: "",
  nome: "",
  escolaVinculada: "",
  endereco: "",
};

export function NovaGirotecaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setOpen(false);
    setForm(FORM_VAZIO);
    setErro(null);
  }

  function setField(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "codigo") setErro(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nome.trim() || !form.escolaVinculada.trim())
      return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/v1/admin/girotecas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: form.codigo.trim(),
          nome: form.nome.trim(),
          escolaVinculada: form.escolaVinculada.trim(),
          endereco: form.endereco.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setErro(body.error ?? "Erro ao criar giroteca.");
        return;
      }
      router.refresh();
      fechar();
    } finally {
      setSalvando(false);
    }
  }

  const podeConfirmar =
    Boolean(form.codigo.trim()) &&
    Boolean(form.nome.trim()) &&
    Boolean(form.escolaVinculada.trim()) &&
    !salvando;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Nova giroteca
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova giroteca</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="giroteca-codigo">
                Código{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="giroteca-codigo"
                value={form.codigo}
                onChange={(e) => setField("codigo", e.target.value)}
                placeholder="Ex: ESC001"
                required
                autoFocus
                aria-invalid={!!erro}
                aria-describedby={erro ? "giroteca-erro" : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="giroteca-nome">
                Nome{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="giroteca-nome"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex: Giroteca Escola Municipal Norte"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="giroteca-escola">
                Escola vinculada{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="giroteca-escola"
                value={form.escolaVinculada}
                onChange={(e) => setField("escolaVinculada", e.target.value)}
                placeholder="Ex: Escola Municipal Norte"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="giroteca-endereco">Endereço</Label>
              <Input
                id="giroteca-endereco"
                value={form.endereco}
                onChange={(e) => setField("endereco", e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {erro && (
              <p
                id="giroteca-erro"
                className="text-sm text-red-600"
                role="alert"
              >
                {erro}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!podeConfirmar}>
                {salvando && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar giroteca
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
