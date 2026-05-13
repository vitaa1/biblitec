import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LivroForm } from "components/feature/livro-form";
import { criarLivroAction } from "../actions";

export const metadata = { title: "Novo livro — Biblitec" };

export default function NovoLivroPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/livros"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Novo livro</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <LivroForm action={criarLivroAction} submitLabel="Cadastrar livro" />
        </div>
      </div>
    </div>
  );
}
