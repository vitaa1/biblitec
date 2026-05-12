"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockUsuarios } from "./mock-users";
import type { Usuario } from "./types";
import { gerarSenhaTemporaria } from "./utils";
import { DeactivateDialog } from "./_components/DeactivateDialog";
import { NewUserDialog } from "./_components/NewUserDialog";
import { PapelBadge } from "./_components/PapelBadge";
import { PasswordRevealModal } from "./_components/PasswordRevealModal";
import { StatusBadge } from "./_components/StatusBadge";

interface SenhaModal {
  open: boolean;
  nomeUsuario: string;
  senha: string;
}

interface DesativarDialog {
  open: boolean;
  usuario: Usuario | null;
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(mockUsuarios);
  const [busca, setBusca] = useState("");
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false);
  const [senhaModal, setSenhaModal] = useState<SenhaModal>({
    open: false,
    nomeUsuario: "",
    senha: "",
  });
  const [desativarDialog, setDesativarDialog] = useState<DesativarDialog>({
    open: false,
    usuario: null,
  });

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  function handleCriarUsuario(dados: Omit<Usuario, "id" | "status">) {
    const senha = gerarSenhaTemporaria();
    setUsuarios((prev) => [
      ...prev,
      { ...dados, id: String(Date.now()), status: "ativo" },
    ]);
    setNovoUsuarioOpen(false);
    setSenhaModal({ open: true, nomeUsuario: dados.nome, senha });
  }

  function handleResetarSenha(usuario: Usuario) {
    const senha = gerarSenhaTemporaria();
    setSenhaModal({ open: true, nomeUsuario: usuario.nome, senha });
  }

  function handleDesativarConfirmar() {
    if (!desativarDialog.usuario) return;
    setUsuarios((prev) =>
      prev.map((u) =>
        u.id === desativarDialog.usuario!.id ? { ...u, status: "inativo" } : u,
      ),
    );
    setDesativarDialog({ open: false, usuario: null });
  }

  const emailsExistentes = usuarios.map((u) => u.email.toLowerCase());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Gestalt - Região comum: header com título + ação global separados do conteúdo */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie os acessos ao sistema Giroteca
            </p>
          </div>
          <Button
            onClick={() => setNovoUsuarioOpen(true)}
            aria-label="Abrir formulário para criar novo usuário"
          >
            Novo usuário
          </Button>
        </div>

        {/* Gestalt - Região comum: área de filtros delimitada, separada da tabela */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <Input
            id="busca"
            type="search"
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-sm"
            aria-label="Filtrar usuários por nome ou e-mail"
          />
        </div>

        {/* Gestalt - Fechamento: tabela com borda completa delimitando a unidade */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {/* Gestalt - Proximidade: header separado do corpo pela divisória */}
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Nome
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  E-mail
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Papel
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Giroteca vinculada
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Ações
                </th>
              </tr>
            </thead>

            {/* Gestalt - Continuidade: divide-y guia o olhar horizontalmente */}
            <tbody className="divide-y divide-gray-100 bg-white">
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    Nenhum usuário encontrado para &ldquo;{busca}&rdquo;
                  </td>
                </tr>
              )}
              {usuariosFiltrados.map((usuario) => (
                /* Gestalt - Figura-fundo: inativo com opacidade reduzida recua para o fundo */
                <tr
                  key={usuario.id}
                  className={
                    usuario.status === "inativo" ? "opacity-50" : undefined
                  }
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {usuario.nome}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {usuario.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <PapelBadge papel={usuario.papel} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {usuario.girotecaVinculada ?? "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={usuario.status} />
                  </td>

                  {/* Gestalt - Proximidade: ações da linha agrupadas juntas, à direita */}
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResetarSenha(usuario)}
                        aria-label={`Resetar senha de ${usuario.nome}`}
                      >
                        Resetar senha
                      </Button>
                      {usuario.status === "ativo" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDesativarDialog({ open: true, usuario })
                          }
                          aria-label={`Desativar usuário ${usuario.nome}`}
                        >
                          Desativar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          {usuariosFiltrados.length} de {usuarios.length} usuários
        </p>
      </div>

      {/* Dialogs fora do layout principal para não herdar a opacidade das linhas inativas */}
      <NewUserDialog
        open={novoUsuarioOpen}
        emailsExistentes={emailsExistentes}
        onCriar={handleCriarUsuario}
        onCancelar={() => setNovoUsuarioOpen(false)}
      />

      <PasswordRevealModal
        open={senhaModal.open}
        nomeUsuario={senhaModal.nomeUsuario}
        senha={senhaModal.senha}
        onClose={() => setSenhaModal((s) => ({ ...s, open: false }))}
      />

      <DeactivateDialog
        open={desativarDialog.open}
        nomeUsuario={desativarDialog.usuario?.nome ?? ""}
        onConfirmar={handleDesativarConfirmar}
        onCancelar={() => setDesativarDialog({ open: false, usuario: null })}
      />
    </div>
  );
}
