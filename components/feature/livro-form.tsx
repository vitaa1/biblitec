"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LivroFormState = {
  errors?: {
    titulo?: string[];
    autores?: string[];
    categoria?: string[];
    capaUrl?: string[];
    isbn?: string[];
    editora?: string[];
    anoPublicacao?: string[];
    descricao?: string[];
    _form?: string[];
  };
};

export type LivroFormAction = (
  prevState: LivroFormState,
  formData: FormData,
) => Promise<LivroFormState>;

const CATEGORIAS = [
  "Infantil",
  "Juvenil",
  "Didático",
  "Literatura",
  "Outros",
] as const;

const ANO_MAX = new Date().getFullYear();

interface LivroFormProps {
  action: LivroFormAction;
  initialData?: {
    titulo?: string;
    autores?: string;
    categoria?: string;
    capaUrl?: string;
    isbn?: string;
    editora?: string;
    anoPublicacao?: number;
    descricao?: string;
  };
  submitLabel: string;
}

export function LivroForm({ action, initialData, submitLabel }: LivroFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [categoria, setCategoria] = useState(initialData?.categoria ?? "");
  const [capaUrl, setCapaUrl] = useState(initialData?.capaUrl ?? "");
  const [expanded, setExpanded] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {/* Título */}
      <div className="space-y-1.5">
        <Label htmlFor="titulo">
          Título <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <Input
          id="titulo"
          name="titulo"
          defaultValue={initialData?.titulo}
          autoFocus
          placeholder="Ex: Dom Casmurro"
          aria-describedby={state.errors?.titulo ? "titulo-error" : undefined}
          aria-invalid={!!state.errors?.titulo}
        />
        {state.errors?.titulo && (
          <p id="titulo-error" className="text-sm text-red-600" role="alert">
            {state.errors.titulo[0]}
          </p>
        )}
      </div>

      {/* Autores */}
      <div className="space-y-1.5">
        <Label htmlFor="autores">
          Autores <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <Input
          id="autores"
          name="autores"
          defaultValue={initialData?.autores}
          placeholder="Ex: Machado de Assis"
          aria-describedby={state.errors?.autores ? "autores-error" : undefined}
          aria-invalid={!!state.errors?.autores}
        />
        {state.errors?.autores && (
          <p id="autores-error" className="text-sm text-red-600" role="alert">
            {state.errors.autores[0]}
          </p>
        )}
      </div>

      {/* Categoria */}
      <div className="space-y-1.5">
        <Label htmlFor="categoria-trigger">
          Categoria <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <input type="hidden" name="categoria" value={categoria} />
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger
            id="categoria-trigger"
            className="w-full"
            aria-describedby={
              state.errors?.categoria ? "categoria-error" : undefined
            }
            aria-invalid={!!state.errors?.categoria}
          >
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.categoria && (
          <p id="categoria-error" className="text-sm text-red-600" role="alert">
            {state.errors.categoria[0]}
          </p>
        )}
      </div>

      {/* Capa */}
      <div className="space-y-1.5">
        <Label htmlFor="capaUrl">URL da capa</Label>
        <Input
          id="capaUrl"
          name="capaUrl"
          type="url"
          value={capaUrl}
          onChange={(e) => setCapaUrl(e.target.value)}
          placeholder="https://exemplo.com/capa.jpg"
          aria-describedby={state.errors?.capaUrl ? "capaUrl-error" : undefined}
          aria-invalid={!!state.errors?.capaUrl}
        />
        {state.errors?.capaUrl && (
          <p id="capaUrl-error" className="text-sm text-red-600" role="alert">
            {state.errors.capaUrl[0]}
          </p>
        )}
      </div>

      {/* Bloco "Mais informações" */}
      <div className="rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          aria-expanded={expanded}
          aria-controls="mais-informacoes"
        >
          Mais informações
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && (
          <div
            id="mais-informacoes"
            className="space-y-4 border-t border-gray-200 p-4"
          >
            {/* ISBN */}
            <div className="space-y-1.5">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                name="isbn"
                defaultValue={initialData?.isbn ?? ""}
                placeholder="10 ou 13 dígitos numéricos"
                aria-describedby={state.errors?.isbn ? "isbn-error" : undefined}
                aria-invalid={!!state.errors?.isbn}
              />
              {state.errors?.isbn && (
                <p id="isbn-error" className="text-sm text-red-600" role="alert">
                  {state.errors.isbn[0]}
                </p>
              )}
            </div>

            {/* Editora */}
            <div className="space-y-1.5">
              <Label htmlFor="editora">Editora</Label>
              <Input
                id="editora"
                name="editora"
                defaultValue={initialData?.editora ?? ""}
                placeholder="Ex: Companhia das Letras"
                aria-describedby={
                  state.errors?.editora ? "editora-error" : undefined
                }
                aria-invalid={!!state.errors?.editora}
              />
              {state.errors?.editora && (
                <p
                  id="editora-error"
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {state.errors.editora[0]}
                </p>
              )}
            </div>

            {/* Ano de publicação */}
            <div className="space-y-1.5">
              <Label htmlFor="anoPublicacao">Ano de publicação</Label>
              <Input
                id="anoPublicacao"
                name="anoPublicacao"
                type="number"
                min={1450}
                max={ANO_MAX}
                defaultValue={initialData?.anoPublicacao ?? ""}
                placeholder={`Ex: ${ANO_MAX}`}
                aria-describedby={
                  state.errors?.anoPublicacao
                    ? "anoPublicacao-error"
                    : undefined
                }
                aria-invalid={!!state.errors?.anoPublicacao}
              />
              {state.errors?.anoPublicacao && (
                <p
                  id="anoPublicacao-error"
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {state.errors.anoPublicacao[0]}
                </p>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                name="descricao"
                defaultValue={initialData?.descricao ?? ""}
                placeholder="Resumo ou sinopse do livro"
                rows={4}
                aria-describedby={
                  state.errors?.descricao ? "descricao-error" : undefined
                }
                aria-invalid={!!state.errors?.descricao}
              />
              {state.errors?.descricao && (
                <p
                  id="descricao-error"
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {state.errors.descricao[0]}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Erro geral */}
      {state.errors?._form && (
        <p className="text-sm text-red-600" role="alert">
          {state.errors._form[0]}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
