import { contextoFromServerComponent } from "lib/contexto";
import { listarComContadores } from "models/girotecas";
import { DesativarGirotecaDialog } from "./_components/desativar-giroteca-dialog";
import { NovaGirotecaDialog } from "./_components/nova-giroteca-dialog";

export default async function AdminGirotecasPage() {
  const contexto = await contextoFromServerComponent();
  const lista = await listarComContadores(contexto);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Gestalt — Região comum: header separado do conteúdo */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Girotecas</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie as unidades do sistema
            </p>
          </div>
          <NovaGirotecaDialog />
        </div>

        {/* Gestalt — Fechamento: tabela delimitada por borda */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Nome
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Código
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Escola
                </th>
                {/* Gestalt — Proximidade: os 3 contadores agrupados juntos */}
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Exemplares
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Leitores
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Em aberto
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Ações
                </th>
              </tr>
            </thead>

            {/* Gestalt — Continuidade: divide-y guia o olhar horizontalmente */}
            <tbody className="divide-y divide-gray-100 bg-white">
              {lista.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    Nenhuma giroteca cadastrada.
                  </td>
                </tr>
              )}
              {lista.map((g) => (
                /* Gestalt — Figura-fundo: inativa com opacidade reduzida recua para o fundo */
                <tr key={g.id} className={!g.ativa ? "opacity-50" : undefined}>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {g.nome}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-mono text-sm text-gray-500">
                      {g.codigo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {g.escolaVinculada}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm text-gray-700">
                      {g.totalExemplares}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm text-gray-700">
                      {g.totalLeitores}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {g.totalEmprestimosAbertos > 0 ? (
                      <span className="text-sm font-medium text-amber-600">
                        {g.totalEmprestimosAbertos}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        g.ativa
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-gray-100 text-gray-500 ring-gray-500/20"
                      }`}
                    >
                      {g.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  {/* Gestalt — Proximidade: ações da linha agrupadas à direita */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {g.ativa && (
                      <DesativarGirotecaDialog
                        girotecaId={g.id}
                        nomeGiroteca={g.nome}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          {lista.length} giroteca{lista.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
