# README

## Documentação do projeto

- [Convenções do domínio musical](docs/dominio-musical.md)
- [Decisão de áudio: Tone.js e Salamander locais](docs/decisao-audio.md)
- [Estado atual do projeto](docs/estado-atual.md)
- [Contrato musical do MVP 1](docs/contrato-musical-mvp1.md)
- [Persistência de composições](docs/persistencia-composicoes-mvp1.md)
- [Timeline de composições](docs/timeline-composicoes-mvp1.md)

## Autenticação local

O Bardian usa Devise para autenticar usuários por e-mail e senha. O cadastro
público cria usuários comuns; a dashboard administrativa exige um usuário com
`role: admin`.

Em desenvolvimento, copie o exemplo para `.env`, substitua o e-mail e defina
uma senha local antes de executar o seed. O Rails carrega essas variáveis por
meio de `dotenv-rails`; o `.env` real não deve ser versionado:

```bash
cp .env.example .env
# Edite .env e preencha ADMIN_EMAIL e ADMIN_PASSWORD antes do comando abaixo.
mise exec -- bin/rails db:seed
```

Em outros ambientes, forneça `ADMIN_EMAIL` e `ADMIN_PASSWORD` como variáveis do
processo, sem depender de `.env`.

As rotas de conta são `/users/sign_in` e `/users/sign_up`. Usuários comuns são
encaminhados para a página pública após o login e podem abrir suas composições
em `/compositions`; administradores são encaminhados para `/dashboard`.

## Relatórios de desenvolvimento

A dashboard administrativa apresenta entregas concluídas a partir do catálogo
versionado em `config/dev_reports.yml`. Cada entrada contém título, descrição
curta, alterações criadas ou modificadas, data, tags e um caminho interno para
testar a funcionalidade. O objeto `DevReport` valida o catálogo e a página
permite buscar texto e filtrar por tag. Não há tabela de banco nem cadastro pela
interface; o registro deve acompanhar a implementação de cada nova entrega.

O catálogo reúne as entregas verificadas do projeto. Cada nova funcionalidade
deve receber um relatório com uma rota existente para teste; planos e recursos
ainda não implementados não são registrados como entregas.

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
