import { redirect } from "next/navigation";
import { contextoFromServerComponent } from "lib/contexto";
import { NovoEmprestimoForm } from "../_components/novo-emprestimo-form";

export const metadata = { title: "Novo empréstimo — Biblitec" };

export default async function NovoEmprestimoPage() {
  const contexto = await contextoFromServerComponent();
  if (contexto.papel !== "gestor_giroteca" || !contexto.girotecaId) {
    redirect("/");
  }
  return <NovoEmprestimoForm />;
}
