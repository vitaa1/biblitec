import { contarResumoEmprestimos } from "models/emprestimos";
import { contextoFromServerComponent } from "lib/contexto";
import { CardResumo } from "./_components/card-resumo";
import { AtalhosRapidos } from "./_components/atalhos-rapidos";

export default async function HomePage() {
  const contexto = await contextoFromServerComponent();
  const { emAberto, atrasados } = await contarResumoEmprestimos(contexto);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 grid grid-cols-2 gap-4">
        <CardResumo
          titulo="Em aberto"
          subtitulo="empréstimos ativos"
          valor={emAberto}
          href="/emprestimos"
        />
        <CardResumo
          titulo="Atrasados"
          subtitulo="empréstimos atrasados"
          valor={atrasados}
          href="/emprestimos?aba=atrasados"
          destaque={atrasados > 0}
        />
      </div>
      <AtalhosRapidos />
    </main>
  );
}
