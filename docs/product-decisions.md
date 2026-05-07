# Decisões de produto

Decisões sobre como o sistema se comporta em cenários específicos do dia a dia das girotecas. Para o resumo do escopo MVP, veja [`CLAUDE.md`](../CLAUDE.md) seção 3.

## Está dentro do MVP

- Login para gestores e admin NTHE
- Catálogo de livros (visualização e busca por título, autor, ISBN)
- Cadastro de livro com **campos básicos** apenas: título, autores, categoria, capa. ISBN serve para auto-preencher; outros campos (editora, ano, descrição) ficam em "Mais opções" recolhível.
- Gestão de exemplares (cópias físicas) por giroteca
- Cadastro de leitores
- Empréstimo, devolução e renovação
- Listagem de empréstimos em aberto e atrasados
- Indicador básico de "X empréstimos atrasados" na home (sem dashboard cheio de gráficos)

## Está FORA do MVP

Se alguém pedir, a resposta é "fica para v1.1". Documente o pedido em uma issue marcada `pos-mvp` e siga em frente.

- ❌ Reservas antecipadas de livros
- ❌ Notificações por SMS, email ou WhatsApp
- ❌ Catálogo público para alunos pesquisarem online
- ❌ Sistema de multas ou penalidades
- ❌ Importação em massa de leitores (cadastro manual no MVP)
- ❌ Foto do leitor
- ❌ Histórico de leitura individual do aluno como relatório
- ❌ Avaliação ou rating de livros pelos alunos
- ❌ Dashboards com gráficos e relatórios exportáveis (apenas o indicador básico está no MVP)
- ❌ Promoção automática de livro `local` para `central`
- ❌ Modo offline (MVP exige conexão estável)
- ❌ App mobile nativo
- ❌ Leitura de código de barras por câmera (apenas leitor USB)
- ❌ Integração com sistema acadêmico da SEMEC
- ❌ Tipo de leitor "comunidade externa" (apenas aluno, professor e funcionário no MVP)

## Comportamentos específicos

### Livro perdido

Gestor marca o exemplar com status `baixado` e seleciona motivo "Perdido". Adiciona observação livre se quiser ("perdido por [leitor], em [data]"). Sem multa, sem fluxo especial.

O empréstimo aberto correspondente é fechado com a data de devolução em branco e observação registrando a perda.

### Livro danificado na devolução

Gestor seleciona estado "danificado" no momento da devolução (campo opcional). Status do exemplar pode permanecer `disponivel` se o dano for leve, ou ser marcado como `baixado` (motivo "Danificado") se inutilizado. Decisão fica com o gestor.

### Sem internet no meio do empréstimo

UI deve detectar perda de conexão e mostrar mensagem clara ("Sem conexão com o servidor. Tente novamente em alguns instantes.").

- **Não congelar a tela.**
- Não tentar persistir localmente — isso é offline e está fora do MVP.
- Botão "Tentar novamente" deve estar visível.

### Adição de livro novo no catálogo central

Quando o admin do NTHE adiciona um livro novo no catálogo central, ele precisa decidir manualmente se cria exemplares para todas as girotecas ou apenas para algumas.

**Não há criação automática em massa.** Se isso virar gargalo, vira feature de v1.1.

### Empréstimo com leitor que tem atraso

Sistema **bloqueia** o empréstimo. Mensagem: "Este leitor tem empréstimos em atraso. Registre a devolução antes de novo empréstimo."

Sem opção de "ignorar e continuar mesmo assim" no MVP. Se virar problema operacional, revisamos.

### Limite de 3 empréstimos abertos por leitor

Configurável via constante `MAX_EMPRESTIMOS_ATIVOS = 3`. Mensagem ao bater limite: "Este leitor já tem 3 empréstimos em aberto. Devolva um antes de pegar outro."

### Categorias de livros

Lista fechada (select), não texto livre. Opções iniciais (revisar com NTHE):

- Infantil
- Juvenil
- Didático
- Literatura
- Outros

Adicionar nova categoria exige migration — protege contra fragmentação ("Infantil", "infantil", "Inf").
