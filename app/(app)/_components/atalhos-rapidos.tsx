import Link from "next/link";

const ATALHOS = [
  { label: "+ Novo empréstimo", href: "/emprestimos/novo" },
  { label: "↩ Devolução", href: "/emprestimos?aba=devolucao" },
  { label: "+ Cadastrar leitor", href: "/leitores/novo" },
] as const;

export function AtalhosRapidos() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ATALHOS.map((atalho) => (
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
