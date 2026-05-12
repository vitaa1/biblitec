import { contextoFromServerComponent } from "lib/contexto";
import { buscarComFiltros } from "models/livros";
import { LivroList } from "./_components/livro-list";

export const metadata = { title: "Catálogo — Biblitec" };

export default async function LivrosPage() {
  const contexto = await contextoFromServerComponent();
  const initialData = await buscarComFiltros({}, contexto);
  const totalPages = Math.max(1, Math.ceil(initialData.total / 50));

  return (
    <LivroList
      initialData={{
        livros: initialData.livros,
        total: initialData.total,
        page: 1,
        totalPages,
      }}
    />
  );
}
