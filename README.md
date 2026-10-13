# README

## Documentação do projeto

- [Convenções do domínio musical](docs/dominio-musical.md)
- [Decisão de áudio: Tone.js e Salamander locais](docs/decisao-audio.md)
- [Estado atual do projeto](docs/estado-atual.md)

## Autenticação local

O Bardian usa Devise para autenticar usuários por e-mail e senha. O cadastro
público cria usuários comuns; a dashboard administrativa exige um usuário com
`role: admin`.

Para criar o administrador inicial sem versionar credenciais, defina as duas
variáveis no ambiente e execute o seed:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='defina-uma-senha-local' mise exec -- bin/rails db:seed
```

As rotas principais são `/users/sign_in`, `/users/sign_up` e `/dashboard`.
Usuários comuns são encaminhados temporariamente para a página pública após o
login; administradores são encaminhados para a dashboard.

This README would normally document whatever steps are necessary to get the
application up and running.

Things you may want to cover:

* Ruby version

* System dependencies

* Configuration

* Database creation

* Database initialization

* How to run the test suite

* Services (job queues, cache servers, search engines, etc.)

* Deployment instructions

* ...
