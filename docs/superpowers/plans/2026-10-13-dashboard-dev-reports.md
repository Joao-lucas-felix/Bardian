# Dashboard administrativa e DevReports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir na dashboard administrativa uma tabela de entregas versionadas, começando pela própria dashboard, com busca, filtro por tag e link real de teste.

**Architecture:** `DevReport` é um objeto Ruby sem Active Record que lê um catálogo YAML versionado. O controller carrega e filtra os registros; a view principal compõe partials de navegação, controles e tabela. A rota e a autorização administrativa existentes permanecem.

**Tech Stack:** Rails 8.1, Ruby, ERB, CSS, YAML padrão e Minitest; nenhuma nova dependência ou migração.

**Spec:** `docs/superpowers/specs/2026-10-13-dashboard-dev-reports-design.md`

## Global Constraints

- Somente a entrega atual entra no catálogo; não registrar retrospectivamente funcionalidades antigas.
- O piano roll não faz parte desta implementação.
- Os links de teste são caminhos internos para funcionalidades existentes.
- Busca e filtro devem funcionar; não criar controles decorativos.
- Manter a dashboard restrita a administradores.
- Comentários e documentação de código em português.
- Planejar e revisar a separação de responsabilidades dos ERB conforme `AGENTS.md` §§54-A–54-B.
- Preservar mudanças locais não relacionadas e deixar as specs fora dos commits.

## Mapa de responsabilidades

- `config/dev_reports.yml`: catálogo versionado, inicialmente com uma entrega.
- `app/models/dev_report.rb`: leitura, validação e filtragem dos registros.
- `app/controllers/dashboard_controller.rb`: parâmetros GET, carregamento e seleção dos dados para a view.
- `app/views/dashboard/index.html.erb`: composição da página e cabeçalho compacto.
- `app/views/dashboard/_sidebar.html.erb`: navegação lateral já existente, preservando as rotas e a conta.
- `app/views/dashboard/_filters.html.erb`: busca, filtro por tag e limpeza.
- `app/views/dashboard/_reports_table.html.erb`: tabela semântica e estado sem resultados.
- `app/views/dashboard/_report_row.html.erb`: resumo, tags, detalhes expansíveis e link de teste de cada relatório.
- `app/assets/stylesheets/presentation.css`: identidade e comportamento responsivo da dashboard.
- `test/models/dev_report_test.rb`, `test/controllers/dashboard_controller_test.rb`: regras do catálogo e comportamento HTTP.
- `README.md`, `docs/estado-atual.md`: orientar inclusão de novas entregas e atualizar o estado da dashboard.

## Review Focus

1. `q` ou `tag` enviados como array/hash devem ser tratados como entrada vazia, sem erro 500 (Task 2).
2. Tag desconhecida deve produzir estado sem resultados, não uma lista completa enganosa (Task 1/2).
3. Campos obrigatórios ausentes ou link externo no YAML devem falhar de forma explícita na leitura, não produzir links inseguros (Task 1).
4. Um relatório com alterações extensas deve manter detalhes acessíveis por teclado e legíveis na tabela estreita (Task 2; verificação manual).
5. Visitante e usuário comum continuam sem acesso direto à dashboard ou ao primeiro link de teste (Task 2).

---

### Task 1: Catálogo e objeto DevReport

**Files:**
- Create: `config/dev_reports.yml`, `app/models/dev_report.rb`, `test/models/dev_report_test.rb`

**Interfaces:**
- Produces: `DevReport.load(path: Rails.root.join("config/dev_reports.yml")) -> Array<DevReport>`; leitores `slug`, `title`, `description`, `changes`, `delivered_on`, `tags`, `test_path`; `DevReport.filter(reports:, query:, tag:) -> Array<DevReport>`; `DevReport.tags(reports:) -> Array<String>`.
- Catalog schema: top-level `reports:` array; each item has the reader keys above, with `changes` and `tags` arrays and quoted ISO-8601 date.
- Invalid catalog raises `ArgumentError` naming the offending field; `test_path` must begin with `/` but not `//`.

- [ ] **Step 1: Write failing model tests.** Assert one catalog item for `Dashboard administrativa e DevReports`, description and non-empty changes/tags, internal test path `/dashboard#dev-reports`; assert case-insensitive text search over title/description/changes/tags, tag filtering, combined filters, unknown tag empty, empty filters all, sorted tags, invalid required field and external path rejection using temporary catalog fixtures.
- [ ] **Step 2: Run red tests.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/models/dev_report_test.rb`; expect missing class/catalog failures.
- [ ] **Step 3: Implement catalog and object.** Use `YAML.safe_load_file`; normalize non-null string fields, parse date with `Date.iso8601`, validate arrays and internal path; keep filtering in Ruby, with no database access. Document class and methods in Portuguese.
- [ ] **Step 4: Run green tests.** Same command; expect 0 failures.
- [ ] **Step 5: Review and commit only Task 1 paths.** `git diff --check` and `git add` those three files, then commit `feat: add versioned DevReport catalog` if committing is appropriate for the current working tree; do not stage specs.

### Task 2: Controller, view composta e filtros administrativos

**Files:**
- Modify: `app/controllers/dashboard_controller.rb`, `app/views/dashboard/index.html.erb`, `app/assets/stylesheets/presentation.css`, `test/controllers/dashboard_controller_test.rb`, `README.md`, `docs/estado-atual.md`
- Create: `app/views/dashboard/_sidebar.html.erb`, `app/views/dashboard/_filters.html.erb`, `app/views/dashboard/_reports_table.html.erb`, `app/views/dashboard/_report_row.html.erb`

**Interfaces:**
- Consumes: Task 1's `DevReport.load`, `.filter` and `.tags`.
- Produces: `@reports`, `@available_tags`, `@query`, `@selected_tag`; `#dev-reports` section with a semantic table, one expandable detail area per report, a real GET form, clear-filter link to `dashboard_path`, and `Testar` link to `report.test_path`. Only scalar string `q` and `tag` params are accepted; invalid shapes become empty strings. Partials receive explicit locals (`reports`, `available_tags`, `query`, `selected_tag`, or `report`).

- [ ] **Step 1: Write failing integration tests.** Admin GET `/dashboard` shows exactly the first report, description, date, tags, expandable changes and `/dashboard#dev-reports` test link; existing sidebar destinations/logout remain. Search matches change text, non-match and unknown tag show empty state, `tag=Interface` matches, reset link is present, array/hash params do not raise; visitor redirects to login and common user is denied.
- [ ] **Step 2: Run red tests.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/dashboard_controller_test.rb`; expect new report assertions to fail.
- [ ] **Step 3: Implement `index`.** Load catalog once per request, derive tags from all reports, normalize scalar params, filter with Task 1 interface; leave existing `before_action` guards unchanged. Update the index method's Portuguese documentation.
- [ ] **Step 4: Compose ERB partials.** Preserve sidebar routes in `_sidebar`; keep `index` declarative; use other partials for controls, table and rows. No queries, authorization decisions or domain rules in ERB. Use native `<details>` for alterations; make GET search/tag/reset controls functional without JavaScript.
- [ ] **Step 5: Adapt CSS.** Match the reference's dark fixed left rail, restrained white content, compact header/toolbar, navy table heading and subtle tags; preserve readable keyboard focus and reflow/scroll access on narrow screens. No copied insurance text, fake statistics or inactive actions.
- [ ] **Step 6: Run green controller and model tests.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/models/dev_report_test.rb test/controllers/dashboard_controller_test.rb`; expect 0 failures.
- [ ] **Step 7: Update docs.** Explain adding future catalog entries and the current dashboard behavior, with the limitations of versioned/manual metadata; keep all new comments/documentation in Portuguese.
- [ ] **Step 8: Review and commit only scoped implementation files.** Review ERB responsibility boundaries per `AGENTS.md`; `git diff --check`; stage named files only; commit `feat: show DevReports in admin dashboard` if scoped commit is appropriate. Do not stage specs or unrelated dirty files.

### Task 3: End-to-end verification

**Files:** No new files unless a finding within the authorized scope needs a correction.

- [ ] **Step 1: Run full suite.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test`; expect 0 failures and 0 errors.
- [ ] **Step 2: Run style check.** `mise exec -- bin/rubocop`; expect 0 offenses.
- [ ] **Step 3: Inspect desktop and narrow viewport.** Verify screenshot/rendered page, working search/tag/reset, one first report, details expansion, test link, focus states, mobile overflow, and admin-only access. If a browser is unavailable, report that limitation explicitly.
- [ ] **Step 4: Review final diff.** Confirm only intended paths changed; no credentials, old-feature backfill, or spec files staged; report remaining limitations and test evidence.
