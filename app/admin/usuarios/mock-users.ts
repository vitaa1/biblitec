import type { Usuario } from "./types";

export const mockUsuarios: Usuario[] = [
  {
    id: "1",
    nome: "Ana Cristina Melo",
    email: "ana.melo@nthe.pi.gov.br",
    papel: "admin_nthe",
    status: "ativo",
  },
  {
    id: "2",
    nome: "Carlos Eduardo Lima",
    email: "carlos.lima@giroteca.pi.gov.br",
    papel: "gestor",
    girotecaVinculada: "Giroteca Escola Estadual São João",
    status: "ativo",
  },
  {
    id: "3",
    nome: "Fernanda Sousa",
    email: "fernanda.sousa@giroteca.pi.gov.br",
    papel: "gestor",
    girotecaVinculada: "Giroteca CMEI Jardim América",
    status: "ativo",
  },
  {
    id: "4",
    nome: "Roberto Alves",
    email: "roberto.alves@giroteca.pi.gov.br",
    papel: "usuario",
    status: "ativo",
  },
  {
    id: "5",
    nome: "Patrícia Nunes",
    email: "patricia.nunes@giroteca.pi.gov.br",
    papel: "usuario",
    status: "inativo",
  },
  {
    id: "6",
    nome: "Marcos Vinicius Costa",
    email: "marcos.costa@nthe.pi.gov.br",
    papel: "admin_nthe",
    status: "ativo",
  },
  {
    id: "7",
    nome: "Juliana Ferreira",
    email: "juliana.ferreira@giroteca.pi.gov.br",
    papel: "gestor",
    girotecaVinculada: "Giroteca UEB Raimundo Nonato",
    status: "inativo",
  },
];

export const girotecasDisponiveis = [
  "Giroteca Escola Estadual São João",
  "Giroteca CMEI Jardim América",
  "Giroteca UEB Raimundo Nonato",
  "Giroteca CMEI Parque Piauí",
  "Giroteca UEB Professor Moura",
];
