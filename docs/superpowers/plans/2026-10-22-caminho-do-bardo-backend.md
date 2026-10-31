# Caminho do Bardo Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar catálogo versionado, trilha autenticada e conclusão individual de aulas publicadas, sem escrever ainda as aulas.

**Architecture:** Metadados das aulas ficam em YAML versionado e são lidos por um catálogo Ruby; o corpo de cada aula fica em um partial ERB próprio. `LessonCompletion` é a única persistência nova e pertence a `User`. Um controller consulta catálogo e conclusões para renderizar a trilha e a aula, e grava a conclusão por `current_user`.

**Tech Stack:** Rails 8.1, Active Record, Devise, SQLite, ERB e Minitest já presentes no projeto; nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-22-caminho-do-bardo-backend-design.md`

## Global Constraints

- Todas as aulas publicadas são legíveis em qualquer ordem; a trilha não bloqueia páginas.
- `slug` é identidade estável; título e ordem podem mudar sem perder conclusões.
- Só aulas publicadas com template próprio podem ser abertas e concluídas.
- O cliente não escolhe `user_id`; conclusão pertence sempre a `current_user`.
- Conteúdo, currículo detalhado, áudio, pixel art e recompensas ficam para etapas posteriores.
- Todo código e teste produzido terá documentação ou comentários explicativos em português, conforme `AGENTS.md`.
- Uma entrega implementada e verificada recebe entrada em `config/dev_reports.yml` com rota existente.

## Review Focus

- YAML vazio: a trilha mostra estado de preparação sem exceção; testar na Task 1 e na Task 3.
- `slug` malformado ou duplicado: o catálogo recusa configuração inválida; testar na Task 1.
- Duas requisições de conclusão para a mesma aula: há uma linha e a data inicial permanece; testar na Task 2 e na Task 3.
- Aula não publicada ou sem template: leitura e conclusão retornam 404; testar na Task 1 e na Task 3.
- Usuários diferentes: uma conclusão não aparece na trilha de outra conta; testar na Task 3.

---

## Mapa de arquivos e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `config/bard_path_lessons.yml` | Lista de metadados, inicialmente `lessons: []`. |
| `app/models/bard_path/lesson_catalog.rb` | Validação, ordem e consulta às aulas publicadas. |
| `db/migrate/<timestamp>_create_lesson_completions.rb` | Tabela, chave estrangeira e índice único. |
| `app/models/lesson_completion.rb`, `app/models/user.rb` | Associação e validações de conclusão. |
| `config/routes.rb`, `app/controllers/bard_path_controller.rb` | Leitura autenticada e conclusão. |
| `app/views/bard_path/index.html.erb`, `app/views/bard_path/show.html.erb` | Estrutura mínima da trilha e da aula. |
| `app/views/bard_path/lessons/_<slug>.html.erb` | Corpo futuro de cada aula, criado apenas quando a aula for escrita. |
| `app/views/shared/_product_navigation.html.erb` | Acesso à trilha na navegação atual. |
| `test/models/bard_path/lesson_catalog_test.rb`, `test/models/lesson_completion_test.rb`, `test/controllers/bard_path_controller_test.rb` | Contrato do catálogo, persistência e rotas. |

### Task 1: Catálogo de aulas publicadas

**Files:** Create `config/bard_path_lessons.yml`, `app/models/bard_path/lesson_catalog.rb`, `test/models/bard_path/lesson_catalog_test.rb`.

**Interfaces:** `BardPath::LessonCatalog.new(entries:, template_exists:)` recebe entradas hash e um predicado de template para testes; `BardPath::LessonCatalog.current` carrega o YAML do projeto e verifica partials em `app/views/bard_path/lessons`. `#published` devolve aulas ordenadas; `#find_published!(slug)` devolve uma aula ou levanta `ActiveRecord::RecordNotFound`. Aula expõe `slug`, `title`, `summary`, `position` e `published?`; `published` é booleano explícito no YAML.

- [ ] **Step 1: Escrever testes falhando.** `#published` em YAML vazio é `[]`; entradas publicadas saem por `position`; `#find_published!` recusa `slug` desconhecido, não publicado ou sem template; construtor recusa `slug` fora de `/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/`, duplicado, título/resumo vazios e posições duplicadas.
- [ ] **Step 2: Confirmar falha.** Rodar `mise exec -- bin/rails test test/models/bard_path/lesson_catalog_test.rb`; esperar falha por classe ainda ausente.
- [ ] **Step 3: Implementar o mínimo.** YAML inicial `lessons: []`; carregar com `YAML.safe_load`; validar metadados ao construir o catálogo; usar `Rails.root.join("app/views/bard_path/lessons/_#{slug}.html.erb")` somente após validar `slug`. Se um item marcado como publicado não tiver template, não o expor.
- [ ] **Step 4: Confirmar passagem.** Repetir o comando da Step 2; esperar zero falhas.
- [ ] **Step 5: Registrar esta unidade.** Commit apenas dos três arquivos desta task.

### Task 2: Conclusão vinculada à conta

**Files:** Create `db/migrate/<timestamp>_create_lesson_completions.rb`, `app/models/lesson_completion.rb`, `test/models/lesson_completion_test.rb`; modify `app/models/user.rb`, `db/schema.rb` via migration.

**Interfaces:** `User#lesson_completions`; `LessonCompletion` pertence a `User`, valida presença de `lesson_slug` e `completed_at`, e tem índice único `[user_id, lesson_slug]`. A unicidade fica somente no banco para que `create_or_find_by!` possa recuperar a linha após conflito concorrente. O controller da Task 3 usa `current_user.lesson_completions.create_or_find_by!(lesson_slug: slug) { |record| record.completed_at = Time.current }`.

- [ ] **Step 1: Escrever testes falhando.** Duas contas podem concluir o mesmo `slug`; o índice único recusa duas linhas do mesmo `slug` para uma conta; excluir a conta remove suas conclusões; `completed_at` é obrigatório.
- [ ] **Step 2: Confirmar falha.** Rodar `mise exec -- bin/rails test test/models/lesson_completion_test.rb`; esperar falha por tabela/classe ausente.
- [ ] **Step 3: Implementar o mínimo.** Migração com `t.references :user, null: false, foreign_key: true`, `lesson_slug` e `completed_at` não nulos, `t.timestamps` e índice único; associação `dependent: :destroy` em `User`. Rodar `mise exec -- bin/rails db:migrate`.
- [ ] **Step 4: Confirmar passagem.** Repetir o teste da Step 2 e conferir `db/schema.rb`; esperar zero falhas.
- [ ] **Step 5: Registrar esta unidade.** Commit apenas dos arquivos desta task.

### Task 3: Rotas, trilha e aula

**Files:** Modify `config/routes.rb`, `app/views/shared/_product_navigation.html.erb`; create `app/controllers/bard_path_controller.rb`, `app/views/bard_path/index.html.erb`, `app/views/bard_path/show.html.erb`, `test/controllers/bard_path_controller_test.rb` e fixture de partial sob `test/fixtures/views/bard_path/lessons/` para a aula publicada de teste.

**Interfaces:** `BardPathController#index`, `#show`, `#complete`; helpers de rota `bard_path_index_path`, `bard_path_lesson_path(slug:)`, `complete_bard_path_lesson_path(slug:)`. `#index` passa lista de aulas e conjunto de `lesson_slug` concluídos; `#show` passa aula e estado de conclusão; `#complete` usa a associação e o catálogo das Tasks 1–2. O teste injeta um catálogo com `BardPath::LessonCatalog.stub(:current, test_catalog)` e acrescenta seu diretório de templates à view path, sem publicar aula falsa no produto.

- [ ] **Step 1: Escrever testes falhando.** Login é exigido nas três rotas; trilha vazia renderiza estado de preparação; duas aulas publicadas podem ser abertas fora de ordem; conclusão repetida não duplica linha nem muda data; outro usuário vê ambas como não concluídas; `slug` inexistente, não publicado ou sem template recebe 404 em leitura e conclusão. Usar catálogo de teste com template de fixture para os cenários publicados.
- [ ] **Step 2: Confirmar falha.** Rodar `mise exec -- bin/rails test test/controllers/bard_path_controller_test.rb`; esperar falha por rotas/controller ausentes.
- [ ] **Step 3: Implementar o mínimo.** Criar rotas GET/GET/POST definidas na spec, `before_action :authenticate_user!`, `#complete` com `create_or_find_by!`, redirect à aula e aviso. Index e show preparam dados, templates só apresentam. Inserir link global sem alterar a rota inicial das composições.
- [ ] **Step 4: Confirmar passagem.** Repetir o teste da Step 2; esperar zero falhas. Revisar ERB para impedir consultas, autorização e regras de progresso nas views.
- [ ] **Step 5: Registrar esta unidade.** Commit apenas dos arquivos desta task.

### Task 4: Verificação integrada e entrega

**Files:** Modify `config/dev_reports.yml`; corrigir somente arquivos das Tasks 1–3 se a verificação revelar defeito no escopo.

**Interfaces:** Rota de teste do DevReport: `/caminho-do-bardo`.

- [ ] **Step 1: Verificar o fluxo.** Rodar testes das Tasks 1–3 em conjunto e `PARALLEL_WORKERS=1 mise exec -- bin/rails test`; separar falhas preexistentes das causadas pela etapa.
- [ ] **Step 2: Verificar estrutura.** Rodar `mise exec -- bin/rails routes` filtrando `caminho-do-bardo` e `git diff --check`; conferir `/caminho-do-bardo` autenticada em navegador, se o servidor local puder iniciar.
- [ ] **Step 3: Registrar a entrega verificada.** Adicionar título, descrição curta, alterações, data `2026-10-22`, tags e `test_path: /caminho-do-bardo` em `config/dev_reports.yml`. Se não houver rota verificável, informar a limitação e não registrar entrega incompleta.
- [ ] **Step 4: Confirmar o registro.** Rodar `mise exec -- bin/rails test test/models/dev_report_test.rb` e `git diff --check`; esperar zero falhas referentes a esta etapa.
- [ ] **Step 5: Registrar o fechamento.** Commit apenas das correções da etapa e do DevReport. Informar resultados, limitações e decisões ao autor antes de avançar ao frontend.
