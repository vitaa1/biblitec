import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buscarPorId } from "models/livros";
import { contextoFromServerComponent } from "lib/contexto";
import { LivroForm } from "components/feature/livro-form";
import { editarLivroAction } from "../../actions";
import { AppError } from "infra/errors";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarLivroPage({ params }: Props) {
  const { id } = await params;
  const contexto = await contextoFromServerComponent();
  const livro = await buscarPorId(id);

  if (!livro) notFound();

  // Gestor só edita livros locais da própria giroteca
  if (
    contexto.papel === "gestor_giroteca" &&
    (livro.origem === "central" ||
      livro.criadoPorGirotecaId !== contexto.girotecaId)
  ) {
    throw new AppError("Não autorizado.", 403);
  }

  const action = editarLivroAction.bind(null, id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href={`/livros/${id}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao livro
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Editar livro</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <LivroForm
            action={action}
            initialData={{
              titulo: livro.titulo,
              autores: livro.autores,
              categoria: livro.categoria ?? undefined,
              capaUrl: livro.capaUrl ?? undefined,
              isbn: livro.isbn ?? undefined,
              editora: livro.editora ?? undefined,
              anoPublicacao: livro.anoPublicacao ?? undefined,
              descricao: livro.descricao ?? undefined,
            }}
            submitLabel="Salvar alterações"
          />
        </div>
      </div>
    </div>
  );
}
