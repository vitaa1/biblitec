import Link from "next/link";

const ATALHOS_GESTOR = [
  { label: "+ Novo empréstimo", href: "/emprestimos/novo" },
  { label: "↩ Devolução", href: "/devolucoes" },
  { label: "+ Cadastrar leitor", href: "/leitores/novo" },
] as const;

const ATALHOS_ADMIN = [
  { label: "+ Cadastrar leitor", href: "/leitores/novo" },
] as const;

interface AtalhosRapidosProps {
  isGestor: boolean;
}

export function AtalhosRapidos({ isGestor }: AtalhosRapidosProps) {
  const atalhos = isGestor ? ATALHOS_GESTOR : ATALHOS_ADMIN;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {atalhos.map((atalho) => (
        <Link
          key={atalho.href}
          href={atalho.href}
          className="rounded-lg border border-gray-200 px-4 py-3 text-center text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          {atalho.label}
        </Link>
      ))}
    </div>
  );
}
