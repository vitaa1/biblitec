import { contextoFromServerComponent } from "lib/contexto";
import { listarPorLivroNaGiroteca } from "models/exemplares";
import { AdicionarExemplarDialog } from "./adicionar-exemplar-dialog";
import { BaixarExemplarDialog } from "./baixar-exemplar-dialog";

interface Props {
  livroId: string;
}

const STATUS_CONFIG = {
  disponivel: {
    label: "Disponível",
    dotClass: "bg-green-500",
    badgeClass: "bg-green-50 text-green-700 ring-green-600/20",
  },
  emprestado: {
    label: "Emprestado",
    dotClass: "bg-yellow-500",
    badgeClass: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  },
  baixado: {
    label: "Baixado",
    dotClass: "bg-gray-400",
    badgeClass: "bg-gray-50 text-gray-600 ring-gray-500/20",
  },
} as const;

const ESTADO_LABEL = {
  novo: "Novo",
  bom: "Bom",
  regular: "Regular",
  danificado: "Danificado",
} as const;

export async function ExemplaresSection({ livroId }: Props) {
  const contexto = await contextoFromServerComponent();
  const lista = await listarPorLivroNaGiroteca(livroId, contexto);
  const podeGerenciar = !!contexto.girotecaId;

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Exemplares desta giroteca
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {lista.length}
          </span>
        </h2>
        {podeGerenciar && (
          <AdicionarExemplarDialog
            livroId={livroId}
            girotecaId={contexto.girotecaId!}
          />
        )}
      </div>

      {lista.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-500">
          Nenhum exemplar cadastrado nesta giroteca.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lista.map((exemplar) => {
            const cfg = STATUS_CONFIG[exemplar.status];
            return (
              <li
                key={exemplar.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3"
              >
                <span className="w-28 font-mono text-sm font-medium text-gray-900">
                  {exemplar.codigoTombamento}
                </span>
                <span className="w-20 text-sm text-gray-500">
                  {ESTADO_LABEL[exemplar.estado]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.badgeClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`}
                    aria-hidden="true"
                  />
                  {cfg.label}
                  {exemplar.nomeLeitor && ` — ${exemplar.nomeLeitor}`}
                </span>
                {podeGerenciar && exemplar.status !== "baixado" && (
                  <div className="ml-auto">
                    <BaixarExemplarDialog exemplar={exemplar} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
