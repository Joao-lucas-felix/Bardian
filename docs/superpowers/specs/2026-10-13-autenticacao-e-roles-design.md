# Especificação: autenticação e roles do Bardian

Data: 13 de outubro de 2026  
Estado: proposta aprovada em conversa; aguardando revisão do documento antes da implementação.

## 1. Objetivo

Adicionar autenticação ao Bardian com Devise e separar o acesso entre usuários
comuns e administradores. A área administrativa já possui uma dashboard visual;
esta etapa deve proteger essa área e criar a base para que usuários comuns
possam utilizar funcionalidades autenticadas no futuro.

O incremento deve resolver autenticação e autorização básica sem implementar
conteúdo musical, editor, persistência de composição ou funcionalidades
administrativas adicionais.

## 2. Decisões aprovadas

- Usar a gem Devise para autenticação baseada em sessão.
- Usar um único modelo `User`.
- Representar o perfil por um campo `role`.
- Roles iniciais: `user` e `admin`.
- Permitir cadastro público para usuários comuns.
- Criar o administrador inicial por seed/configuração.
- Usar a mesma tela de login para os dois perfis.
- Redirecionar cada perfil para seu destino após o login.
- Proteger a dashboard administrativa contra visitantes e usuários comuns.
- Não adicionar recuperação de senha por e-mail neste primeiro incremento.

O Devise oferece os módulos de autenticação, registro e validação necessários
para este fluxo e documenta o uso de um campo de papel quando diferentes
perfis compartilham o mesmo modelo de autenticação.

## 3. Modelo de dados

Será criado `User` com os campos necessários ao Devise e:

- `role`, com valor inicial `user`;
- restrição para aceitar somente `user` ou `admin`;
- métodos de domínio `admin?` e `user?` para evitar comparações de strings
  espalhadas pelos controllers e views.

A autenticação usará e-mail e senha. A senha nunca será armazenada em texto
simples; o armazenamento será feito pelo mecanismo de senha do Devise.

Não haverá um modelo `Admin` separado. Essa escolha reduz duplicação e mantém
um único fluxo de login, enquanto o campo `role` permite restringir a
autorização.

## 4. Módulos do Devise

O primeiro incremento usará somente os módulos necessários ao escopo:

- `database_authenticatable`: validação de e-mail e senha;
- `registerable`: cadastro, edição e exclusão da conta do usuário;
- `validatable`: validações básicas de e-mail e senha.

`recoverable`, confirmação de e-mail, bloqueio automático e autenticação
multifator ficam fora desta etapa. A inclusão posterior desses módulos exigirá
configuração de infraestrutura e uma decisão de escopo própria.

## 5. Fluxos de usuário

### Cadastro

1. Visitante abre a tela de cadastro.
2. Informa e-mail, senha e confirmação de senha.
3. Devise valida os dados e cria um `User` com `role: user`.
4. O usuário é autenticado conforme o comportamento padrão configurado.
5. O usuário é encaminhado temporariamente para a página pública `/`, até que
   exista uma área autenticada específica para usuários comuns.

O formulário não aceitará `role` enviado pelo navegador. O perfil será definido
no modelo ou no fluxo do servidor, evitando que um visitante se registre como
administrador.

### Login

1. Usuário informa e-mail e senha na tela única de login.
2. Devise autentica a conta.
3. O sistema redireciona conforme o perfil:
   - `admin`: dashboard administrativa;
   - `user`: página pública `/`, que será substituída quando houver uma área
     autenticada específica para usuários comuns.

Credenciais inválidas devem retornar uma mensagem genérica, sem revelar se o
e-mail está cadastrado.

### Logout

O usuário autenticado poderá encerrar a sessão por uma ação explícita de
logout. A dashboard não deve permanecer acessível após o encerramento da
sessão.

## 6. Autorização administrativa

O `ApplicationController` concentrará o mecanismo compartilhado de proteção.
Controllers administrativos usarão:

```ruby
before_action :authenticate_user!
before_action :require_admin!
```

`require_admin!` verificará `current_user.admin?`. Usuários autenticados sem a
role adequada serão redirecionados para uma página segura, com mensagem que
indica falta de permissão sem expor detalhes internos.

A verificação não ficará somente nas views ou na navegação. A proteção deverá
ocorrer no controller para que acesso direto por URL também seja bloqueado.

## 7. Rotas previstas

O primeiro incremento deverá adicionar as rotas do Devise para `users` e
proteger a rota administrativa existente:

- `/users/sign_in`;
- `/users/sign_up`;
- `/users/sign_out`;
- `/dashboard` protegido para administradores.

As rotas públicas existentes, como a apresentação e a demonstração de áudio,
continuarão públicas, salvo decisão posterior.

## 8. Administrador inicial

O seed criará ou atualizará de forma idempotente um administrador a partir de
variáveis de ambiente:

- `ADMIN_EMAIL`;
- `ADMIN_PASSWORD`.

O seed não terá uma senha real fixa no repositório. Quando qualquer uma das
variáveis não estiver configurada, a execução deverá falhar com uma mensagem
clara informando que `ADMIN_EMAIL` e `ADMIN_PASSWORD` são obrigatórios. A
documentação de setup deverá mostrar como definir as duas variáveis antes de
executar o seed.

O seed nunca deverá converter automaticamente o primeiro usuário cadastrado
em administrador.

## 9. Interface

Devise terá views locais para que a tela de login e cadastro usem o layout
visual do Bardian. A dashboard manterá a barra lateral escura, mas seu acesso
deverá ser mostrado apenas quando houver administrador autenticado.

O primeiro incremento não precisa criar uma área completa para usuários
comuns. Deve existir, porém, um destino válido após o cadastro/login para não
deixar o fluxo sem saída.

## 10. Testes

Os testes deverão cobrir:

- criação de usuário comum pelo cadastro;
- role padrão igual a `user`;
- impossibilidade de definir `admin` pelo formulário público;
- login com credenciais válidas;
- rejeição de credenciais inválidas;
- logout;
- visitante impedido de acessar `/dashboard`;
- usuário comum impedido de acessar `/dashboard`;
- administrador autorizado a acessar `/dashboard`;
- seed administrativo idempotente;
- ausência de senha fixa ou role controlável pelo cliente.

Os testes de controller/integration devem verificar o comportamento HTTP e os
redirecionamentos. O modelo deve testar as regras de role e validação que não
dependem da navegação.

## 11. Segurança e limites

- Não aceitar `role` em parâmetros permitidos do cadastro.
- Não incluir credenciais reais em fixtures, seeds versionados ou mensagens.
- Manter os filtros de log para senha e tokens.
- Usar as proteções de sessão e CSRF fornecidas pelo Rails e Devise.
- Não tratar role como substituto de autorização detalhada para recursos
  futuros.
- Não adicionar recuperação por e-mail ou confirmação sem configurar o serviço
  correspondente.

## 12. Fora do escopo

- Gerenciamento de usuários por administradores.
- Múltiplas permissões além de `user` e `admin`.
- OAuth, login social ou autenticação multifator.
- Recuperação de senha por e-mail.
- Confirmação de e-mail.
- Perfis públicos, avatar ou dados pessoais adicionais.
- Persistência de composições por usuário.
- Conteúdo específico da área administrativa.

## 13. Critério de conclusão

A etapa será considerada concluída quando:

- Devise estiver instalado e configurado;
- `User` possuir as roles definidas;
- cadastro, login e logout funcionarem;
- o administrador puder ser criado pelo seed/configuração;
- `/dashboard` aceitar somente administradores;
- usuário comum tiver um destino válido após login;
- as telas de autenticação usarem o layout do projeto;
- os testes cobrirem os fluxos e bloqueios principais;
- setup, limitações e credenciais de ambiente estiverem documentados.
