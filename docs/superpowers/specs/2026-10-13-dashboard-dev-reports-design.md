# Especificação: dashboard administrativa e DevReports

Data: 13 de outubro de 2026  
Estado: proposta visual e conceitual alinhada em conversa; aguardando revisão deste documento.

## Objetivo

Transformar a dashboard administrativa vazia em um painel de entregas do Bardian,
usando a imagem fornecida como referência de composição: barra lateral escura,
cabeçalho compacto, controles de busca e filtro e tabela clara. O conteúdo será
próprio do projeto acadêmico, sem dados ou ações da corretora mostrada na imagem.

A primeira e única entrega registrada nesta etapa será a própria dashboard e
seu catálogo de relatórios. Funcionalidades anteriores não serão incluídas
retroativamente. O piano roll é um exemplo de entrega futura, não um recurso
implementado neste incremento.

## Fonte dos relatórios

Cada funcionalidade concluída terá uma entrada em um catálogo versionado no
repositório. O objeto Ruby `DevReport` lerá esse catálogo e oferecerá os dados
à dashboard. Não haverá tabela no banco, formulário de cadastro, geração a
partir de commits nem inferência automática a partir dos arquivos de código.
"Gerar" significa transformar as entradas deliberadamente registradas junto
às entregas em relatórios exibidos automaticamente pelo painel.

Cada entrada terá:

- identificador estável;
- título da funcionalidade;
- descrição curta, com uma frase sobre o resultado;
- lista objetiva do que foi criado ou modificado;
- data da entrega;
- tags para identificação e filtro;
- caminho interno para testar a funcionalidade.

O primeiro registro descreverá a dashboard administrativa e apontará para a
seção de DevReports em `/dashboard`. Esse link permite verificar a entrega e
se submete à mesma autorização administrativa da página. Registros futuros
deverão apontar para a rota real da funcionalidade, respeitando a autorização
própria da rota; não serão publicados links para recursos ainda inexistentes.

## Interface

A barra lateral escura permanecerá fixa no desktop, com as rotas úteis já
existentes e a ação de sair. O conteúdo principal terá cabeçalho compacto com
identidade Bardian e identificação de área administrativa. Abaixo, a busca e
o filtro por tag antecederão a tabela de entregas. Não haverá filtro de status:
o catálogo conterá somente entregas concluídas.

Cada linha exibirá título, descrição curta, data, tags e o link `Testar`.
As alterações criadas/modificadas aparecerão em uma área expansível vinculada
à linha, para preservar a leitura compacta da tabela. Busca por texto e filtro
por tag usarão parâmetros GET, com uma ação real de limpar filtros. A busca
abrangerá título, descrição, alterações e tags; um filtro sem resultados
mostrará uma mensagem clara, sem linhas fictícias.

O layout deve manter legibilidade, navegação por teclado, foco visível e
semântica de tabela. Em telas estreitas, a navegação deixará de ocupar uma
coluna fixa e os dados continuarão acessíveis sem cortar conteúdo. Não serão
incluídos botões de download, exclusão, revisão, indicadores ou números sem
comportamento e dados reais.

## Fluxo e responsabilidades

1. O catálogo versionado contém somente as entregas verificadas.
2. `DevReport` valida e expõe seus campos, sem depender de Active Record.
3. `DashboardController#index` carrega os relatórios e aplica busca/filtro.
4. A view renderiza controles, tabela, detalhes e estados vazios.
5. O acesso a `/dashboard` continua exigindo autenticação e role `admin`.

Quando uma funcionalidade futura for entregue, sua implementação acrescentará
uma entrada ao catálogo com descrição, alterações, tags e rota de teste. Isso
será parte da própria entrega, não uma operação manual na dashboard.

## Testes e verificação

- Testar leitura do catálogo e campos obrigatórios do `DevReport`.
- Testar busca por texto e filtro por tag, inclusive ausência de resultados.
- Testar a renderização do primeiro registro, das tags, da descrição, das
  alterações expansíveis e do link de teste.
- Preservar testes de acesso: visitante e usuário comum não veem a dashboard;
  administrador vê a tabela.
- Verificar manualmente a composição no navegador em desktop e tela estreita,
  além de navegação por teclado e funcionamento dos links/controles.
- Executar suíte Rails e análise estática disponíveis no projeto.

## Limites

Não implementar o piano roll, relatórios de funcionalidades antigas, edição
de relatórios pela interface, banco de dados para relatórios, exportação,
estatísticas ou ações simuladas. A imagem orienta o layout, não o domínio ou
os textos do Bardian.
