import type { StatusUsuario } from "../types";

const STATUS_CONFIG: Record<
  StatusUsuario,
  { label: string; className: string }
> = {
  ativo: {
    label: "Ativo",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  inativo: {
    label: "Inativo",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
};

interface StatusBadgeProps {
  status: StatusUsuario;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
