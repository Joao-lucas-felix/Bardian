# Módulo legado e superfície ativa do Bardian

## Status

Design aprovado pelo autor em 20/10/2026. A implementação ainda não começou.

## Objetivo

Reduzir a superfície pública do Bardian ao fluxo que representa a versão atual do
TCC: autenticação, CRUD de composições e composição de harmonias. O código das
experiências anteriores deve deixar de ser servido pelas rotas principais, mas
permanecer preservado em um módulo legado para consulta, comparação e eventual
recuperação.

## Resultado esperado

Depois da migração:

```text
autenticação
    ↓
biblioteca de composições
    ↓
composição
    ↓
composição de harmonias
```

O usuário não verá mais, na navegação ativa ou nas rotas públicas:

- apresentação institucional;
- dashboard e suas barras laterais;
- jornada de aprendizagem anterior;
- criação experimental anterior;
- demonstração de áudio isolada;
- editor/timeline antigo;
- harmonia pública temporária anterior.

O root autenticado encaminhará para a biblioteca de composições. As páginas de
login e cadastro continuam disponíveis. O health check continua disponível para
operação da aplicação.

## Limite entre ativo e legado

### Ativo

- `CompositionsController` e suas views de índice, criação, detalhe, edição e
  capa;
- `CompositionHarmoniesController` e as views de harmonia persistida;
- `HarmonyInstrumentCatalog` e o motor openDAW local;
- domínio musical usado pelo CRUD e pela harmonia;
- controllers Stimulus usados por composição e harmonia;
- layout mínimo, navegação de produto e estilos necessários a esses fluxos;
- Devise e páginas de autenticação.

### Legado preservado

Os seguintes elementos sairão das rotas e imports ativos e serão movidos para uma
estrutura de legado coerente, mantendo seus nomes e documentação de origem quando
isso reduzir o risco da migração:

- `PagesController` e views `pages/*`;
- `DashboardController` e views `dashboard/*`;
- `AudioDemoController` e view de demonstração;
- `HarmonyController` e fluxo público `/harmonia`;
- rota `/compositions/:id/legacy` e a timeline/editor antigo;
- controllers Stimulus de criação, piano demonstrativo, música narrativa e áudio
  que não forem consumidos pelo fluxo ativo;
- partials de apresentação, aprendizagem, dashboard e criação experimental;
- folhas `presentation.css` e as regras exclusivas do editor antigo em
  `productivity.css`;
- testes que validam exclusivamente essas superfícies, realocados para a área
  de legado ou removidos quando não houver mais código executável correspondente.

O módulo legado não será carregado pela navegação nem pelos manifests ativos. A
preservação é de código e documentação, não de disponibilidade pública.

## Organização proposta

Para evitar um falso isolamento apenas por convenção de nomes, o ativo permanece
nas pastas Rails usuais e o material retirado passa a ter uma raiz explícita:

```text
app/legacy/
├── controllers/
├── views/
├── javascript/
└── stylesheets/

test/legacy/
docs/legacy/
```

Arquivos compartilhados só permanecem no ativo se houver um consumidor real no
CRUD ou na harmonia. Um helper ou estilo que contenha apenas regras das páginas
antigas deve acompanhar o legado; regras compartilhadas serão extraídas para um
arquivo ativo pequeno, com responsabilidade explícita.

## Rotas ativas

Permanecem:

- Devise;
- `/` como entrada da biblioteca;
- `/compositions` e operações CRUD necessárias;
- `/compositions/:id/cover`;
- `/compositions/:id/harmony`;
- `/compositions/:id/harmony/panel`;
- `/compositions/:id/harmony/assist`;
- `/up`.

Deixam de ser registradas:

- `/apresentacao`;
- `/componentes`;
- `/criar` e `/referencias/criar`;
- `/harmonia` e `/harmonia/assist`;
- `/caminho-do-bardo/notas`;
- `/dashboard`;
- `/audio_demo` e `/audio_demo/index`;
- `/compositions/:id/legacy`.

Links de autenticação e navegação serão revisados para apontar apenas para as
rotas ativas. Uma rota antiga deverá resultar em 404 ou redirecionamento explícito
para a biblioteca, conforme o comportamento de segurança e UX escolhido no plano;
ela não deve reativar o fluxo legado.

## Layout e navegação

O layout ativo deixará de carregar `presentation.css` globalmente e não renderizará
componentes de dashboard ou apresentação. A navegação terá apenas:

- marca/início;
- Minhas composições;
- estado de autenticação;
- tema, se continuar sendo usado pelo fluxo ativo.

O layout de harmonia continuará podendo aplicar os cabeçalhos necessários para o
motor openDAW. A barra persistente da harmonia não será substituída pela barra
antiga da dashboard.

## Tratamento de estilos e JavaScript

O `application` manifest/importmap deverá carregar somente os módulos ativos. A
remoção será guiada por consumidores e testes, não por apagar arquivos em lote.
Os estilos de `productivity.css` serão separados em:

- estilos ativos de biblioteca/composição;
- estilos de legado do editor antigo, apresentação e dashboard.

`music_workspace.css`, `harmony.css` e os módulos do editor de harmonia só devem
continuar carregando se suas classes forem encontradas no fluxo atual. O bundle
openDAW e seus assets locais permanecem ativos.

## Testes e verificação

O plano deverá acrescentar testes de rota para confirmar que:

1. o root e a navegação chegam à biblioteca;
2. CRUD e harmonia persistida continuam acessíveis e autorizados;
3. as rotas legadas não aparecem em `rails routes` nem respondem com páginas
   antigas;
4. a autenticação continua funcionando;
5. o carregamento da harmonia não contém imports ou estilos removidos;
6. o build de áudio continua encontrando o catálogo local;
7. não há referências ativas a controllers, helpers, partials ou assets legados.

A validação visual deverá conferir biblioteca, composição e harmonia em desktop e
celular. A etapa não redesenha essas telas; apenas remove a superfície antiga e
garante que a navegação nova continue legível.

## Decisões e limites

- Não apagar o legado nesta etapa; preservá-lo fora das rotas ativas.
- Não reintroduzir uma nova dashboard ou home institucional.
- Não migrar funcionalidades antigas para o fluxo ativo por conveniência.
- Não alterar o modelo musical, persistência ou motor openDAW além do necessário
  para remover dependências das páginas antigas.
- Não fazer uma grande refatoração de domínio nesta etapa; a simplificação é de
  superfície, organização e dependências.
