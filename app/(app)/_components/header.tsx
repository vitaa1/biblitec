import Link from "next/link";
import { LogOut } from "lucide-react";
import { contextoFromServerComponent } from "lib/contexto";
import { buscarProprioPerfil } from "models/usuarios";
import { logoutAction } from "../actions";

export async function AppHeader() {
  const contexto = await contextoFromServerComponent();
  const usuario = await buscarProprioPerfil(contexto);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-900">Biblitec</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/livros"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Catálogo
            </Link>
            <Link
              href="/emprestimos"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Empréstimos
            </Link>
            <Link
              href="/devolucoes"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Devoluções
            </Link>
            <Link
              href="/leitores"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Leitores
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-600 sm:block">
            {usuario.nome}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
