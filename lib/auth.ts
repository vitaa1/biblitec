export type Contexto = {
  usuarioId: string;
  papel: "admin_nthe" | "gestor_giroteca";
  girotecaId: string | null;
};
