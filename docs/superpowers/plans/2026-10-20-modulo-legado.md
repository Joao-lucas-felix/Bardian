# Módulo legado e superfície ativa do Bardian — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Retirar das rotas e dos manifests ativos as experiências antigas, preservando-as em `app/legacy/`, e deixar no ar somente autenticação, CRUD de composições e composição de harmonias.

**Architecture:** O fluxo atual continuará nas pastas Rails convencionais e será tratado como a única superfície de produto. Controllers, views, JavaScript, estilos e testes exclusivos das experiências antigas serão movidos para uma árvore de legado que não participa do autoload, das rotas nem dos manifests. O root será convertido em entrada da biblioteca de composições; o domínio musical e o motor openDAW serão preservados.

**Tech Stack:** Rails 8.1.4, Ruby 4.0.7 via `mise exec --`, Devise, Turbo Frames, importmap, Propshaft, Stimulus, openDAW local/Vite e testes Rails/Node.

**Spec:** `docs/superpowers/specs/2026-10-20-modulo-legado-design.md`

## Global Constraints

- Não apagar o legado nesta etapa; preservá-lo fora das rotas ativas.
- Não reintroduzir uma nova dashboard ou home institucional.
- Não alterar o modelo musical, persistência ou motor openDAW além do necessário para remover dependências das páginas antigas.
- Não fazer uma grande refatoração de domínio nesta etapa.
- Comentários e documentação de código novo ou alterado devem permanecer em português.
- Toda execução Ruby/Rails deve usar `mise exec --`.
- Não adicionar dependências.

## Review Focus

- Uma rota antiga ainda registrada pode reativar um fluxo removido — teste de `rails routes` e requisições 404.
- O layout global pode carregar CSS ou navegação legado sem que uma view o declare — teste de referências nos manifests e inspeção de HTML ativo.
- O CRUD ou a harmonia podem depender de partials aparentemente antigos — teste de renderização autenticada das três telas ativas.
- O root pode continuar acessível como home institucional — teste para usuário autenticado e não autenticado.
- Um controller/arquivo movido pode permanecer no autoload ou quebrar Zeitwerk — `zeitwerk:check` e suíte completa.

## Mapa de arquivos e responsabilidades

### Permanecem ativos

- `app/controllers/application_controller.rb`: autenticação e redirecionamentos necessários.
- `app/controllers/compositions_controller.rb`: CRUD de composições.
- `app/controllers/composition_harmonies_controller.rb`: harmonia persistida, painéis, assistência e salvamento.
- `app/controllers/harmony_controller.rb`: o fluxo público temporário será movido para legado; a harmonia persistida usa `CompositionHarmoniesController`.
- `app/models/composition.rb`, `app/models/composition_harmony.rb` e `app/models/music/*` necessários à composição/harmonia.
- `app/models/harmony_instrument_catalog.rb` e `app/audio_engine/*`.
- `app/views/compositions/*` usados pelo CRUD e `app/views/harmony/*`.
- `app/views/layouts/application.html.erb`, `app/views/shared/_product_navigation.html.erb` e símbolos compartilhados ativos.
- `app/assets/stylesheets/application.css`, `music_workspace.css`, `harmony.css` e o subconjunto ativo de `productivity.css`.
- Controllers Stimulus e módulos JavaScript consumidos pelas composições e pela harmonia.

### Serão avaliados e movidos

- `app/controllers/pages_controller.rb`, `dashboard_controller.rb`, `audio_demo_controller.rb`.
- `app/views/pages/*`, `app/views/dashboard/*`, `app/views/audio_demo/*`.
- `app/views/compositions/legacy.html.erb`, `_timeline.html.erb`, `_region_editor.html.erb` e partials exclusivos do editor antigo.
- `app/controllers/harmony_controller.rb` e somente os arquivos de `app/views/harmony` exclusivos da rota pública temporária; os partials da harmonia persistida permanecem ativos.
- Controllers Stimulus de criação, narrativa, piano demonstrativo, áudio e timeline sem consumidor ativo.
- `presentation.css` e regras antigas de `productivity.css`.
- Testes exclusivos de páginas retiradas, movidos para `test/legacy/` quando a execução isolada continuar útil.

## Task 1: Fixar a matriz ativo/legado com testes de rota

**Files:**
- Modify: `config/routes.rb`
- Modify: `test/controllers/pages_controller_test.rb`
- Modify: `test/controllers/compositions_controller_test.rb`
- Modify: `test/controllers/composition_harmonies_controller_test.rb`
- Create or modify: `test/controllers/legacy_routes_test.rb`
- Modify: `app/controllers/application_controller.rb` if the root redirect requires it

**Interfaces:**
- Produces the active route set consumed by the layout and later cleanup tasks.
- Keeps Devise, CRUD, nested harmony routes, cover route and health check available.

- [ ] **Step 1: Add failing route assertions** for root behavior and the removal of `/apresentacao`, `/componentes`, `/criar`, `/referencias/criar`, `/harmonia`, `/caminho-do-bardo/notas`, `/dashboard`, `/audio_demo` and `/compositions/:id/legacy`.
- [ ] **Step 2: Run the focused Rails tests** with `DATABASE_URL=sqlite3:/tmp/bardian-legacy-routes.sqlite3 mise exec -- bin/rails test ...` and confirm failures identify the old routes.
- [ ] **Step 3: Change `config/routes.rb`** so the root enters the composition library and only the approved active routes remain.
- [ ] **Step 4: Adjust authentication/root redirection** so anonymous users can still reach login and authenticated users reach `/compositions`.
- [ ] **Step 5: Run the focused tests** and verify active routes pass while legacy requests return 404 or the explicitly chosen library redirect.

## Task 2: Simplify the active layout and navigation

**Files:**
- Modify: `app/views/layouts/application.html.erb`
- Modify: `app/views/shared/_product_navigation.html.erb`
- Modify: `app/views/devise/registrations/new.html.erb`
- Modify: `app/views/devise/sessions/new.html.erb` if it references removed routes
- Modify: `app/assets/stylesheets/application.css`
- Modify or create: active stylesheet entry for composition-only styles
- Test: `test/controllers/pages_controller_test.rb`, `test/controllers/compositions_controller_test.rb`, `test/controllers/composition_harmonies_controller_test.rb`

**Interfaces:**
- The active layout renders only the product navigation needed by composition and harmony.
- The harmony page continues to receive its openDAW isolation headers and persistent transport shell.

- [ ] **Step 1: Add assertions** that active HTML has library/composition links and no presentation, dashboard or learning links.
- [ ] **Step 2: Remove global `presentation.css` loading** and any layout-level dashboard/presentation rendering.
- [ ] **Step 3: Reduce `_product_navigation`** to brand, compositions, theme if still consumed, and authentication state.
- [ ] **Step 4: Update Devise links** to active destinations only.
- [ ] **Step 5: Run focused view/controller tests** and inspect rendered navigation for authenticated and anonymous states.

## Task 3: Move legacy controllers and views out of the Rails surface

**Files:**
- Move: `app/controllers/pages_controller.rb` to `app/legacy/controllers/pages_controller.rb`
- Move: `app/controllers/dashboard_controller.rb` to `app/legacy/controllers/dashboard_controller.rb`
- Move: `app/controllers/audio_demo_controller.rb` to `app/legacy/controllers/audio_demo_controller.rb`
- Move: legacy `app/views/pages/*`, `app/views/dashboard/*`, `app/views/audio_demo/*`
- Move: `app/views/compositions/legacy.html.erb` and its exclusive partials
- Create: `docs/legacy/README.md`
- Test: legacy-specific tests and route tests from Task 1

**Interfaces:**
- `app/legacy` is archival and is not autoloaded or rendered by active Rails routes.
- Active composition and harmony views keep only the partials they render.

- [ ] **Step 1: Inventory references** to each controller/view/partial with `rg` and record active consumers before moving.
- [ ] **Step 2: Add a legacy README** explaining that the directory is preserved reference code and is intentionally outside the Rails autoload/route surface.
- [ ] **Step 3: Move only files confirmed exclusive to removed routes** and adjust no active domain behavior.
- [ ] **Step 4: Remove obsolete controller tests from the active suite or relocate them under `test/legacy/` with an explicit archival purpose.**
- [ ] **Step 5: Run `mise exec -- bin/rails zeitwerk:check`** and focused active view tests; expected result is no reference to moved constants.

## Task 4: Separate active and legacy JavaScript/styles

**Files:**
- Modify: `app/javascript/application.js`, `app/javascript/controllers/index.js` and importmap entries as needed
- Move: unused legacy controllers/modules to `app/legacy/javascript/`
- Modify: `app/assets/stylesheets/productivity.css`
- Move: `app/assets/stylesheets/presentation.css` to `app/legacy/stylesheets/`
- Create or modify: `app/assets/stylesheets/legacy.css` only if archival rendering documentation needs a named bundle
- Test: JavaScript suites for active composition/harmony and asset reference checks

**Interfaces:**
- Active JavaScript keeps composition CRUD interactions, piano roll used by harmony, Turbo Frames and openDAW.
- Legacy JavaScript is not registered by Stimulus/importmap and does not load on active pages.

- [ ] **Step 1: Use `rg` to classify every controller/module** by active consumer and add a failing assertion for removed modules not being registered.
- [ ] **Step 2: Remove legacy registrations and imports** while keeping `harmony_controller`, `piano_roll_controller`, `product_navigation_controller` and required audio modules.
- [ ] **Step 3: Split or trim `productivity.css`** so composition/library styles remain active and dashboard/presentation/old-editor rules move to legacy.
- [ ] **Step 4: Run all active Node tests** and `git diff --check`.
- [ ] **Step 5: Run the Rails asset/precompile check** and verify the openDAW bundle still builds with `npm run build:audio`.

## Task 5: Remove dead dependencies and update documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/harmonia-opendaw.md`
- Modify: `docs/plano-de-evolucao.md` or create `docs/legacy/README.md` references
- Modify: `config/dev_reports.yml`
- Modify: affected tests and `test/models/dev_report_test.rb` only if the report schema changes

**Interfaces:**
- Documentation describes the active product as composition library plus harmony.
- DevReport records the completed architectural cleanup and its verification route.

- [ ] **Step 1: Search for active references** to removed paths and controllers; turn each unexpected reference into a correction or an explicit legacy-documentation link.
- [ ] **Step 2: Update README and architectural docs** with the new active boundary and preservation policy.
- [ ] **Step 3: Register the delivery** in `config/dev_reports.yml` with test path and limitations.
- [ ] **Step 4: Run the complete verification suite**:
  - `node --test test/javascript/*.mjs`
  - `DATABASE_URL=sqlite3:/tmp/bardian-legacy-full.sqlite3 mise exec -- bin/rails test`
  - `mise exec -- bin/rails zeitwerk:check`
  - `npm run build:audio`
  - `git diff --check`
- [ ] **Step 5: Perform browser verification** of `/compositions`, composition detail and persisted harmony at desktop and mobile dimensions; confirm legacy paths are unavailable and no page-level overflow is introduced.

## Completion Criteria

- `rails routes` contains only the approved active product routes, authentication and health check.
- The active layout has no presentation/dashboard/learning navigation or global stylesheet.
- Legacy source is preserved under `app/legacy/` and documented, but is not autoloaded, imported or routed.
- CRUD and persisted harmony continue to render, save, edit, reproduce and authorize correctly.
- Musical domain and openDAW behavior remain unchanged except for removal of obsolete consumers.
- Full tests, Zeitwerk, audio build and browser smoke checks pass.
