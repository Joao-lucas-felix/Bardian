# Login Google e prontidão para produção — plano de implementação

> **Para agentes:** usar `superpowers:executing-plans` para executar as tarefas em sequência, com testes antes do código e verificação final.

**Objetivo:** concluir a branch atual com login Google vinculado explicitamente, verificações de CI e commits revisáveis.

**Arquitetura:** Devise continua responsável pelas sessões. OmniAuth recebe a identidade Google; `User` concentra as regras de criação e vinculação, e o callback coordena o resultado. O CI valida Rails, JavaScript e build de áudio antes de uma decisão posterior sobre infraestrutura de deploy.

**Tecnologias:** Rails 8.1, Devise, OmniAuth Google OAuth2, SQLite, Minitest, Node 22, GitHub Actions.

**Especificação:** `docs/superpowers/specs/2026-10-30-login-google-e-prontidao-producao-design.md`.

## Restrições globais

- A branch contém trabalho não commitado do usuário; trabalhar no checkout atual e preservar artefatos fora do escopo.
- Não publicar, fazer merge nem configurar host Kamal fictício como produção.
- Comentários e documentação de código em português; registrar entregas verificadas no DevReport.
- Manter login por senha e evitar associação automática por e-mail.

## Foco da revisão

- Google retorna e-mail sem verificação: recusar autenticação e vinculação.
- E-mail Google já existe em conta local: orientar login por senha sem alterar a conta.
- Identidade Google já pertence a outra conta: recusar vinculação sem trocar a sessão.
- Callback cancelado ou inválido: voltar ao login com erro claro.
- Credenciais OAuth ausentes: login local continua acessível e a opção Google não induz a erro.

---

### Tarefa 1: Identidade Google no domínio

**Arquivos:** `Gemfile`, `Gemfile.lock`, `db/migrate/*_add_google_uid_to_users.rb`, `db/schema.rb`, `app/models/user.rb`, `test/models/user_test.rb`.

**Interface:** `User.authenticate_with_google(auth, current_user: nil)` retorna um resultado explícito de sucesso ou falha; recebe o hash OmniAuth e uma conta autenticada opcional. A busca primária usa `uid` do Google, com índice único.

- [ ] Escrever testes de conta nova, identidade conhecida, vínculo explícito, e-mail não verificado, colisões de e-mail e UID.
- [ ] Executar os testes e confirmar falhas pela ausência da funcionalidade.
- [ ] Adicionar gem, migração e método de domínio documentado; evitar vínculo por e-mail na entrada pública.
- [ ] Executar testes de modelo e confirmar todos verdes.

### Tarefa 2: Fluxo OAuth e interface

**Arquivos:** `config/initializers/devise.rb`, `config/routes.rb`, `app/controllers/users/omniauth_callbacks_controller.rb`, `app/views/devise/sessions/new.html.erb`, `app/views/devise/registrations/new.html.erb`, `app/views/shared/_account_navigation.html.erb`, `app/assets/stylesheets/productivity.css`, `test/integration/google_authentication_test.rb`, `README.md`, `.env.example`, `config/dev_reports.yml`.

**Interface:** POST de autorização Google do Devise, callback `/users/auth/google_oauth2/callback`, ação de vínculo na sessão atual. Login/cadastro exibem opção Google somente com configuração presente.

- [ ] Escrever testes de integração para rotas, botão, criação, login, vínculo, conflito, cancelamento e login local preservado.
- [ ] Executar testes e confirmar falhas esperadas.
- [ ] Implementar configuração por ambiente, callback e UI documentados em português.
- [ ] Executar testes de integração, renderização ERB afetada e suíte Rails completa.

### Tarefa 3: Portas de qualidade para versão básica

**Arquivos:** `.github/workflows/ci.yml`, `config/ci.rb`, `package.json`, `README.md`, `config/dev_reports.yml` e arquivos apontados por falhas de lint/build.

**Interface:** PR e push em `main` executam testes Rails, testes JavaScript, lint e build de áudio; documentação lista variáveis e passos para uma imagem candidata.

- [ ] Registrar os comandos exatos e o estado inicial de Rails, JS, lint e build.
- [ ] Acrescentar jobs de Node e build no CI; atualizar o `bin/ci` e documentação.
- [ ] Corrigir somente falhas impeditivas encontradas, sem refatoração estrutural.
- [ ] Reexecutar Rails, JavaScript, RuboCop, build de áudio e `git diff --check`.
- [ ] Validar Docker localmente se o daemon estiver acessível; caso contrário registrar a limitação.

### Tarefa 4: Revisão e commits da branch

**Arquivos:** todo o diff da branch, com atenção a novos arquivos, migrações, ERB, scripts e artefatos gerados.

- [ ] Inspecionar `git status --untracked-files=all`, possíveis segredos, arquivos gerados e mudanças de responsabilidade em views.
- [ ] Confirmar que as rotas de DevReport existem e que não há regras de domínio novas nos ERB alterados.
- [ ] Executar a verificação final completa e revisar as diferenças staged antes de cada commit.
- [ ] Criar commits por entrega funcional, incluindo especificação e plano, sem incluir arquivos de saída locais.
- [ ] Conferir `git status`, histórico e limitações de produção para repassar ao usuário.
