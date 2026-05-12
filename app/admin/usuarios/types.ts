export type Papel = "admin_nthe" | "gestor_giroteca";

export type StatusUsuario = "ativo" | "inativo";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  girotecaVinculada?: string; // presente apenas para gestores
  status: StatusUsuario;
}
