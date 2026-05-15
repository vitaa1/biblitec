import Link from "next/link";

interface CardResumoProps {
  titulo: string;
  subtitulo: string;
  valor: number;
  href: string;
  destaque?: boolean;
}

export function CardResumo({
  titulo,
  subtitulo,
  valor,
  href,
  destaque = false,
}: CardResumoProps) {
  return (
    <Link
      href={href}
      aria-label={
        destaque
          ? `${titulo}: ${valor} (atenção necessária)`
          : `${titulo}: ${valor}`
      }
      className={`block rounded-lg border p-6 text-center transition-colors hover:bg-gray-50 ${
        destaque ? "border-2 border-red-600" : "border border-gray-200"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {titulo}
      </p>
      <p
        className={`mt-2 text-6xl font-bold leading-none ${
          destaque ? "text-red-600" : "text-gray-900"
        }`}
      >
        {valor}
      </p>
      <p
        className={`mt-2 text-sm ${destaque ? "text-red-600" : "text-gray-400"}`}
      >
        {subtitulo}
      </p>
    </Link>
  );
}
