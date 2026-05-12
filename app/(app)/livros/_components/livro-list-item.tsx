"use client";

import Image from "next/image";
import { BookOpen } from "lucide-react";
import type { LivroComExemplares } from "models/livros";

interface LivroListItemProps {
  livro: LivroComExemplares;
  onClick: () => void;
}

export function LivroListItem({ livro, onClick }: LivroListItemProps) {
  const semExemplares = livro.qtdDisponiveis === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${livro.titulo} — ${livro.autores}`}
      className={[
        "flex h-16 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
        semExemplares ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50",
      ].join(" ")}
    >
      {/* Capa */}
      <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded shadow-sm">
        {livro.capaUrl ? (
          <Image
            src={livro.capaUrl}
            alt={`Capa de ${livro.titulo}`}
            fill
            className="object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (
                e.currentTarget.nextElementSibling as HTMLElement | null
              )?.style.removeProperty("display");
            }}
          />
        ) : null}
        <div
          className={[
            "flex h-full w-full items-center justify-center bg-gray-100",
            livro.capaUrl ? "hidden" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          <BookOpen className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Título e autor */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {livro.titulo}
        </p>
        <p className="truncate text-xs text-gray-500">{livro.autores}</p>
      </div>

      {/* Contador de exemplares */}
      <div
        className={[
          "flex-shrink-0 text-xs font-medium",
          semExemplares ? "text-red-700" : "text-green-700",
        ].join(" ")}
        aria-label={`${livro.qtdDisponiveis} exemplar${livro.qtdDisponiveis === 1 ? "" : "es"} disponível${livro.qtdDisponiveis === 1 ? "" : "is"}`}
      >
        ● {livro.qtdDisponiveis} disponíve{livro.qtdDisponiveis === 1 ? "l" : "is"}
      </div>
    </button>
  );
}
