import { contextoFromServerComponent } from "lib/contexto";
import { buscar, LEITORES_POR_PAGINA } from "models/leitores";
import { LeitorList } from "./_components/leitor-list";

export const metadata = { title: "Leitores — Biblitec" };

export default async function LeitoresPage() {
  const contexto = await contextoFromServerComponent();
  const initialData = await buscar({}, contexto);
  const totalPages = Math.max(
    1,
    Math.ceil(initialData.total / LEITORES_POR_PAGINA),
  );

  return (
    <LeitorList
      initialData={{
        leitores: initialData.leitores,
        total: initialData.total,
        page: 1,
        totalPages,
      }}
    />
  );
}
