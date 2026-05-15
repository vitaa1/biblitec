import { redirect } from "next/navigation";
import { contextoFromServerComponent } from "lib/contexto";
import { listarComFiltros } from "models/emprestimos";
import { EmprestimosView } from "./_components/emprestimos-view";

export const metadata = { title: "Empréstimos — Biblitec" };

export default async function EmprestimosPage() {
  const contexto = await contextoFromServerComponent();
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    redirect("/");
  }

  const initialData = await listarComFiltros({ aba: "em_aberto" }, contexto);

  return <EmprestimosView initialData={initialData} />;
}
