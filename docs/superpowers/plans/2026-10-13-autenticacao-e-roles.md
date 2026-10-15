# Autenticação e roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar autenticação com Devise, cadastro público de usuários comuns e acesso exclusivo de administradores à dashboard.

**Architecture:** Usar um único modelo `User` com `role` string (`user` ou `admin`) e autenticação baseada em sessão do Devise. A autorização administrativa ficará no controller, com `authenticate_user!` seguido de `require_admin!`; a dashboard atual será protegida sem criar um modelo ou namespace `Admin` separado.

**Tech Stack:** Rails 8.1, Devise, Active Record, SQLite, Minitest, Turbo/Hotwire.

**Spec:** `docs/superpowers/specs/2026-10-13-autenticacao-e-roles-design.md`

## Global Constraints

- O cadastro público sempre cria `User` com `role: user`.
- O cliente nunca poderá enviar `role` para elevar seu próprio acesso.
- A dashboard `/dashboard` aceitará somente usuários com `role: admin`.
- O administrador será criado pelo seed usando `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
- Se uma das variáveis administrativas estiver ausente, o seed falhará com mensagem clara.
- A página pública `/` será o destino temporário de usuários comuns após login.
- Recuperação de senha, confirmação de e-mail, MFA, OAuth e gerenciamento de usuários ficarão fora deste incremento.
- Credenciais reais não serão adicionadas ao repositório.
- Comentários de código e documentação adicionados ou modificados neste incremento serão escritos em português e explicarão responsabilidades, decisões e regras não evidentes.

## Review Focus

- Role enviada manualmente no cadastro — deve ser ignorada ou rejeitada, nunca elevar o usuário; cobrir em `test/integration/authentication_test.rb`.
- Visitante acessando `/dashboard` — deve ser redirecionado para login; cobrir no teste de integração.
- Usuário comum acessando `/dashboard` — deve ser recusado e redirecionado para `/`; cobrir no teste de integração.
- Seed com apenas uma credencial — deve falhar antes de criar ou atualizar o administrador; cobrir em `test/tasks/seeds_test.rb`.
- Sessão encerrada tentando voltar à dashboard — deve exigir autenticação novamente; cobrir no teste de logout.

---

### Task 1: Adicionar e configurar o Devise

**Files:**
- Modify: `Gemfile`
- Create: `config/initializers/devise.rb`
- Modify: `config/environments/development.rb` e `config/environments/test.rb` para definir as URLs locais usadas pelo Devise
- Test: verificação de boot e geração de rotas

**Interfaces:**
- Produces: Devise carregado pelo Rails e disponível para `devise_for`, `authenticate_user!` e o modelo `User`.

- [ ] **Step 1: Adicionar `gem "devise"` ao `Gemfile` e instalar a dependência com Bundler.**
- [ ] **Step 2: Executar `bin/rails generate devise:install` e revisar as instruções emitidas pelo gerador.**
- [ ] **Step 3: Definir as URLs locais do mailer nos ambientes de desenvolvimento e teste e manter desabilitados os módulos de recuperação e confirmação de e-mail.**
- [ ] **Step 4: Executar `bin/rails runner "puts Devise::VERSION"` para verificar que o boot carrega Devise.**
- [ ] **Step 5: Executar a suíte existente para confirmar que a instalação não quebrou o aplicativo.**

### Task 2: Criar `User` e a role administrativa

**Files:**
- Create: `app/models/user.rb`
- Create: `db/migrate/*_devise_create_users.rb`
- Test: `test/models/user_test.rb`

**Interfaces:**
- Consumes: Devise configurado na Task 1.
- Produces: `User` com `role`, `admin?`, `user?`, senha autenticada e validações do Devise.

- [ ] **Step 1: Escrever testes para role padrão, `admin?`, `user?`, e-mail inválido e senha inválida.**
- [ ] **Step 2: Gerar o modelo com os módulos `database_authenticatable`, `registerable` e `validatable`.**
- [ ] **Step 3: Ajustar a migration para `role` não nula, default `user` e índice único de e-mail case-insensitive conforme o schema gerado.**
- [ ] **Step 4: Implementar o enum de role no modelo sem aceitar valores fora de `user` e `admin`.**
- [ ] **Step 5: Executar `bin/rails db:migrate` e rodar `bin/rails test test/models/user_test.rb`.**

### Task 3: Adicionar rotas e telas de autenticação

**Files:**
- Modify: `config/routes.rb`
- Create/Modify: `app/views/devise/sessions/new.html.erb`
- Create/Modify: `app/views/devise/registrations/new.html.erb`
- Test: `test/integration/authentication_test.rb`

**Interfaces:**
- Consumes: `User` e rotas do Devise da Task 2.
- Produces: `/users/sign_in`, `/users/sign_up` e `/users/sign_out` com layout Bardian.

- [ ] **Step 1: Adicionar `devise_for :users` e preservar as rotas públicas existentes.**
- [ ] **Step 2: Escrever testes de cadastro comum, login válido, credencial inválida e logout.**
- [ ] **Step 3: Criar as duas views locais de login e cadastro, sem partial compartilhado neste incremento, sem campo de role e sem link de recuperação de senha.**
- [ ] **Step 4: Aplicar classes de autenticação compatíveis com o layout visual atual e mensagens de erro genéricas.**
- [ ] **Step 5: Executar os testes de integração da autenticação e verificar as rotas com `bin/rails routes`.**

### Task 4: Proteger a dashboard e definir redirecionamentos

**Files:**
- Modify: `app/controllers/application_controller.rb`
- Modify: `app/controllers/dashboard_controller.rb`
- Test: `test/integration/authentication_test.rb`

**Interfaces:**
- Consumes: `current_user`, `admin?` e `user?` fornecidos pelo Devise/User.
- Produces: `require_admin!` e redirecionamentos pós-login para dashboard ou `/`.

- [ ] **Step 1: Escrever testes para visitante, usuário comum e administrador acessando `/dashboard`.**
- [ ] **Step 2: Implementar `require_admin!` em `ApplicationController`, redirecionando usuários não autorizados para `root_path` com alerta seguro.**
- [ ] **Step 3: Adicionar `before_action :authenticate_user!` e `before_action :require_admin!` ao `DashboardController`.**
- [ ] **Step 4: Implementar `after_sign_in_path_for` para retornar `dashboard_path` a administradores e `root_path` aos demais usuários.**
- [ ] **Step 5: Testar logout e retorno à dashboard para garantir que a sessão encerrada não mantém acesso.**

### Task 5: Criar seed idempotente do administrador e documentar setup

**Files:**
- Modify: `db/seeds.rb`
- Modify: `README.md`
- Modify: `docs/estado-atual.md` para registrar o estado da autenticação e do acesso administrativo
- Test: `test/tasks/seeds_test.rb`

**Interfaces:**
- Consumes: `User` da Task 2 e variáveis `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Produces: administrador idempotente criado por `bin/rails db:seed`.

- [ ] **Step 1: Escrever testes para seed com ambas as variáveis, repetição do seed e variável ausente.**
- [ ] **Step 2: Implementar a validação de presença das duas variáveis antes de persistir o administrador.**
- [ ] **Step 3: Criar ou atualizar o usuário por e-mail, garantindo `role: admin` sem alterar contas comuns arbitrariamente.**
- [ ] **Step 4: Documentar o comando de configuração e execução sem registrar credenciais reais.**
- [ ] **Step 5: Executar os testes do seed em banco de teste limpo e confirmar idempotência.**

### Task 6: Verificação final e revisão de segurança

**Files:**
- Modify: arquivos necessários somente para correções encontradas
- Test: suíte completa

- [ ] **Step 1: Executar `git diff --check`.**
- [ ] **Step 2: Executar `PARALLEL_WORKERS=1 mise exec -- bin/rails test`.**
- [ ] **Step 3: Executar `mise exec -- bin/brakeman` e revisar alertas relacionados a autenticação.**
- [ ] **Step 4: Verificar `bin/rails routes` para confirmar que a dashboard e as rotas do Devise estão protegidas conforme o plano.**
- [ ] **Step 5: Conferir que a spec permanece fora do commit e preparar um commit separado para a implementação da autenticação.**
