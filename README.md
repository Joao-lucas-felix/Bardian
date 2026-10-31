# README

## Documentação do projeto

- [Convenções do domínio musical](docs/dominio-musical.md)
- [Integração de áudio e harmonia](docs/harmonia-opendaw.md)
- [Estado atual do projeto](docs/estado-atual.md)
- [Contrato musical do MVP 1](docs/contrato-musical-mvp1.md)
- [Persistência de composições](docs/persistencia-composicoes-mvp1.md)
- [Timeline de composições](docs/timeline-composicoes-mvp1.md)

Em `/compositions`, crie uma música com nome e capa opcional. Abra **Escrever
harmonia** para escolher acordes, editar notas, ouvir e salvar a sequência. A
interface ativa não expõe dashboard, apresentação ou editores experimentais; as
versões anteriores ficam preservadas em `app/legacy/` e `docs/legacy/` apenas para
referência acadêmica.

## Motor de áudio da harmonia salva

```bash
# Prepara persistência de capas e compila o SDK local, sem CDN em execução.
mise exec -- bin/rails db:migrate
npm ci --ignore-scripts
node bin/setup-soundfonts
npm run build:audio
mise exec -- bin/rails server
```

Requer Node 22 e navegador com AudioWorklet, WebAssembly e isolamento de origem.
Em produção, use HTTPS; localhost é aceito para desenvolvimento. Os artefatos
ficam em `public/audio-engine` e não são versionados. O Dockerfile inclui o build,
mas a imagem completa ainda precisa ser validada no ambiente de deploy.

A harmonia salva usa openDAW local com quatro presets sintéticos e 11 timbres
FluidR3. A instalação baixa e valida o banco completo (148 MB); a primeira escuta
usa download sob demanda e cache OPFS no navegador. Consulte
[integração e limites](docs/harmonia-opendaw.md) antes de publicar.

## Autenticação

O Bardian usa Devise para autenticar usuários por e-mail e senha ou por Google.
O cadastro público cria usuários comuns. O Google só aparece nas telas quando
`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão configurados. Para criar o
cliente OAuth Web, cadastre no Google Cloud a URI de redirecionamento
`https://SEU_DOMINIO/users/auth/google_oauth2/callback` (ou
`http://localhost:3000/users/auth/google_oauth2/callback` no desenvolvimento).
Use as variáveis do processo ou `.env` local; nunca versione os valores reais.

Uma conta criada por senha não é associada automaticamente pelo e-mail Google.
Entre com a senha e escolha **Vincular Google** no menu da conta. Uma identidade
Google já vinculada não pode ser ligada a outra conta. Contas novas pelo Google
recebem o perfil comum e mantêm uma senha aleatória não divulgada. A opção de
desvincular e a recuperação de senha ainda não fazem parte desta versão.

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

As rotas de conta são `/users/sign_in` e `/users/sign_up`. Após o login, qualquer
perfil é encaminhado para a biblioteca em `/compositions`.

## Verificação da versão candidata

Execute `PARALLEL_WORKERS=1 mise exec -- bin/rails test`,
`node --test test/javascript/*.mjs`, `mise exec -- bin/rubocop` e
`npm run build:audio`. O CI também constrói a imagem Docker. Os artefatos
`public/audio-engine` e o banco de timbres são produzidos no build e não entram
nos commits. Antes de publicar, configure um servidor e domínio HTTPS, os
segredos Rails e Google no ambiente, o callback OAuth do domínio final, volume
persistente para SQLite e Active Storage e backup desse volume. O
`config/deploy.yml` ainda contém endereços de exemplo e não deve ser usado
para deploy real sem essa definição.

## Relatórios de desenvolvimento

As entregas continuam registradas em `config/dev_reports.yml` para o TCC, mas não
há uma dashboard pública no produto ativo. Cada entrada contém título, descrição,
alterações, data, tags e um caminho de verificação. Quatro caminhos históricos
(`/harmonia`, `/criar`, `/componentes` e `/dashboard`) foram preservados no
catálogo para rastreabilidade, embora não estejam ativos nesta versão.

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
