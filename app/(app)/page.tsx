import { contarResumoEmprestimos } from "models/emprestimos";
import { contextoFromServerComponent } from "lib/contexto";
import { CardResumo } from "./_components/card-resumo";
import { AtalhosRapidos } from "./_components/atalhos-rapidos";

export default async function HomePage() {
  const contexto = await contextoFromServerComponent();
  const isGestor = contexto.papel === "gestor_giroteca";
  const resumo = isGestor ? await contarResumoEmprestimos(contexto) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {resumo && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CardResumo
            titulo="Em aberto"
            subtitulo="empréstimos ativos"
            valor={resumo.emAberto}
            href="/emprestimos"
          />
          <CardResumo
            titulo="Atrasados"
            subtitulo="empréstimos atrasados"
            valor={resumo.atrasados}
            href="/emprestimos?aba=atrasados"
            destaque={resumo.atrasados > 0}
          />
        </div>
      )}
      <AtalhosRapidos isGestor={isGestor} />
    </main>
  );
}
