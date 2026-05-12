import type { Papel } from "../types";

const PAPEL_CONFIG: Record<Papel, { label: string; className: string }> = {
  admin_nthe: {
    label: "Administrador",
    className: "bg-purple-100 text-purple-800 border border-purple-200",
  },
  gestor: {
    label: "Gestor",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  usuario: {
    label: "Usuário",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
};

interface PapelBadgeProps {
  papel: Papel;
}

export function PapelBadge({ papel }: PapelBadgeProps) {
  const { label, className } = PAPEL_CONFIG[papel];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
