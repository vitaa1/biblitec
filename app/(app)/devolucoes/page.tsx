import { redirect } from "next/navigation";
import { contextoFromServerComponent } from "lib/contexto";
import { DevolucaoForm } from "./_components/devolucao-form";

export const metadata = { title: "Devolução — Biblitec" };

export default async function DevolucoesPage() {
  const contexto = await contextoFromServerComponent();
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    redirect("/");
  }
  return <DevolucaoForm />;
}
