# Glossário

Termos do domínio do Biblitec. Use exatamente estes termos ao escrever código, documentação e mensagens de UI — usar variações ou traduções gera ambiguidade.

| Termo                    | Significado                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Giroteca**             | Biblioteca escolar de Teresina. Não é "giro" + "teca" no sentido genérico — é o nome oficial do programa da Prefeitura.              |
| **Giratech**             | Projeto do NTHE que aplica tecnologia educacional nas girotecas. O Biblitec é uma ferramenta dentro do Giratech.                     |
| **NTHE**                 | Núcleo de Tecnologia Educacional, da SEMEC Teresina. Responsável pelo Biblitec.                                                      |
| **SEMEC**                | Secretaria Municipal de Educação de Teresina. Cliente final.                                                                         |
| **Tombamento**           | Código físico (etiqueta) colado em cada exemplar. Único por giroteca, não globalmente.                                               |
| **Acervo central**       | Conjunto de livros distribuídos pela SEMEC, presente em todas as girotecas (`livros.origem = 'central'`).                            |
| **Acervo local**         | Livros adicionados especificamente por uma giroteca (`livros.origem = 'local'`).                                                     |
| **Gestor (de giroteca)** | Servidor que opera o sistema na escola. Papel `gestor_giroteca`.                                                                     |
| **Admin NTE**            | Equipe do NTHE com visão geral. Papel `admin_nte`.                                                                                   |
| **Leitor**               | Quem pega livro emprestado. Pode ser aluno, professor ou funcionário.                                                                |
| **Exemplar**             | Cópia física específica de um livro. Não confundir com `livro` (entrada bibliográfica).                                              |
| **Livro**                | Entrada bibliográfica no catálogo. Existe uma única vez, independente de quantos exemplares existem.                                 |
| **Empréstimo**           | Registro de que um leitor pegou um exemplar. Tem `data_emprestimo`, `data_prevista_devolucao` e `data_devolucao` (null = em aberto). |
| **Renovação**            | Estende a `data_prevista_devolucao` em +14 dias. Máximo 2 por empréstimo.                                                            |
| **Baixar (exemplar)**    | Marcar como `status = baixado` (perdido, danificado, descartado). Não é DELETE.                                                      |
| **Biblivre**             | Software anterior, considerado complexo demais. Substituído por este projeto.                                                        |
| **Maria**                | A persona dos usuários gestores — professora readaptada, com baixa familiaridade técnica. Veja `CLAUDE.md` seção 2.                  |
