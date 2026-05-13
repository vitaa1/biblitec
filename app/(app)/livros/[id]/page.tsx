import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil, BookOpen } from "lucide-react";
import { buscarPorId } from "models/livros";
import { contextoFromServerComponent } from "lib/contexto";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LivroDetalhePage({ params }: Props) {
  const { id } = await params;
  const contexto = await contextoFromServerComponent();
  const livro = await buscarPorId(id);

  if (!livro) notFound();

  const podeEditar =
    contexto.papel === "admin_nthe" ||
    (livro.origem === "local" &&
      livro.criadoPorGirotecaId === contexto.girotecaId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/livros"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </Link>
          {podeEditar && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/livros/${id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex gap-6 p-6">
            {/* Capa */}
            <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded shadow">
              {livro.capaUrl ? (
                <Image
                  src={livro.capaUrl}
                  alt={`Capa de ${livro.titulo}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100">
                  <BookOpen className="h-10 w-10 text-gray-300" />
                </div>
              )}
            </div>

            {/* Dados */}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900">{livro.titulo}</h1>
              <p className="mt-1 text-sm text-gray-600">{livro.autores}</p>
              {livro.categoria && (
                <span className="mt-2 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {livro.categoria}
                </span>
              )}
            </div>
          </div>

          {/* Detalhes extras */}
          <dl className="divide-y divide-gray-100 border-t border-gray-100 px-6">
            {livro.isbn && (
              <div className="flex py-3">
                <dt className="w-36 flex-shrink-0 text-sm text-gray-500">ISBN</dt>
                <dd className="text-sm text-gray-900">{livro.isbn}</dd>
              </div>
            )}
            {livro.editora && (
              <div className="flex py-3">
                <dt className="w-36 flex-shrink-0 text-sm text-gray-500">Editora</dt>
                <dd className="text-sm text-gray-900">{livro.editora}</dd>
              </div>
            )}
            {livro.anoPublicacao && (
              <div className="flex py-3">
                <dt className="w-36 flex-shrink-0 text-sm text-gray-500">Ano</dt>
                <dd className="text-sm text-gray-900">{livro.anoPublicacao}</dd>
              </div>
            )}
            {livro.descricao && (
              <div className="flex py-3">
                <dt className="w-36 flex-shrink-0 text-sm text-gray-500">Descrição</dt>
                <dd className="text-sm text-gray-900">{livro.descricao}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
