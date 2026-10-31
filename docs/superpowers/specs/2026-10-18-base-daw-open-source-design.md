# Base de DAW open source para o Bardian

**Estado:** proposta para revisão do autor  
**Data:** 18 de outubro de 2026

## Objetivo

Construir a base de áudio e de edição do Bardian reaproveitando componentes e
implementações open source de DAWs, para reduzir o esforço gasto recriando
recursos comuns. O diferencial do Bardian permanece na composição assistida e
na aprendizagem contextual: a pessoa cria, recebe explicações e possibilidades,
decide o que aplicar e ouve o resultado.

O usuário aceita considerar a licença AGPL e publicar o Bardian como open
source futuramente. Essa intenção permite avaliar o SDK do openDAW, mas não
dispensa o inventário de licenças de cada componente incorporado.

## Estado atual relevante

- O domínio Rails representa notas, acordes, contexto harmônico e uma
  composição versionada em JSON.
- A composição persistida já inclui andamento, compasso, faixas, regiões,
  eventos MIDI, volume, mute, solo e loop.
- A interface já oferece timeline, piano roll, transporte e assistência
  harmônica. Essa interface deve ser avaliada como produto do Bardian, não
  reconstruída sem necessidade.
- `composition_audio.js`, `composition_transport.js` e
  `playback_events.js` implementam atualmente o agendamento e a reprodução.
- `phrase_instruments.js` combina samples locais com síntese procedural simples;
  o piano usa um sample de A4 e vários outros timbres usam osciladores básicos.
  A qualidade sonora depende também de instrumentos, samples e mixagem, não
  apenas da biblioteca que controla o áudio.
- O frontend usa Rails Importmap e não possui `package.json` ou pipeline Vite.
  O pacote npm do openDAW oferece artefatos WASM pré-compilados, mas exige
  avaliar empacotamento de módulos, worker, AudioWorklet e cabeçalhos de
  isolamento COOP/COEP. Compilar o engine do repositório upstream também exige
  Rust; consumir o pacote publicado não implica necessariamente compilar Rust.

## Direção proposta

Avaliar `@opendaw/studio-sdk` como candidato para assumir os recursos genéricos
que hoje exigiriam evolução própria: engine de áudio, relógio musical e
representação executável da sessão. A documentação do projeto descreve um SDK
headless; o projeto anfitrião mantém a interface. O Bardian conservará sua
interface e seu domínio musical, usando um adaptador explícito entre o
documento de composição Rails e a estrutura de execução do SDK.

O documento Rails permanece a fonte persistida durante a primeira integração.
Não se altera o contrato JSON até que a prova de compatibilidade demonstre que
uma migração é necessária e que o ganho compensa o risco. O adaptador converte
o documento validado em estruturas de execução e encaminha mudanças de áudio;
ele não redefine regras harmônicas nem passa lógica musical ao SDK.

Essa direção é condicionada a uma prova técnica inicial. Se a integração não
conseguir reproduzir uma composição real preservando andamento, duração,
faixas e loop, o sprint deve parar nesse ponto e registrar a decisão. Não se
troca automaticamente para outra arquitetura.

## Prova de compatibilidade

Na consulta de 18/10/2026, o pacote publicado era
`@opendaw/studio-sdk` 0.0.174. A prova deve fixar a versão exata testada. O
pacote inclui o engine WASM pré-compilado e documenta um fallback TypeScript,
mas a configuração padrão usa WASM e requer contexto cross-origin isolated
para o `SharedArrayBuffer`. A prova deve testar os cabeçalhos COOP/COEP com os
assets locais do Bardian e verificar `crossOriginIsolated` no navegador.

O primeiro incremento deve usar uma composição real do Bardian com ao menos
duas faixas, notas de durações diferentes, andamento e loop. A prova deve
responder:

1. O SDK instala e executa no contexto Rails atual? Se não, qual alteração de
   build é necessária e qual o custo de manutenção?
2. É possível mapear notas MIDI, ticks, andamento, faixas, volume e loop sem
   alterar o documento persistido?
3. O SDK oferece chamadas públicas suficientes para controlar reprodução e
   ciclo de vida sem depender de componentes internos instáveis?
4. Como são carregados instrumentos e efeitos? É possível obter um som
   comparável ou melhor que o atual com assets licenciados e verificáveis?
5. Quais recursos são disponibilizados pelo SDK e quais continuariam sendo
   responsabilidade do Bardian?
6. Quais licenças e avisos precisam acompanhar o código, dependências,
   instrumentos e samples?

O resultado deve conter uma demonstração executável, uma tabela de recursos
reaproveitados versus recursos próprios, um mapa do fluxo de dados, o custo de
build/implantação e uma decisão documentada de continuar ou interromper a
adoção do SDK.

## Escopo do sprint após a prova

Se a prova for aprovada, o sprint de base deve:

- substituir a implementação de reprodução por uma integração encapsulada,
  sem expor o SDK aos controllers Stimulus ou ao domínio Ruby;
- preservar o contrato musical persistido enquanto a conversão for segura;
- adotar instrumentos ou fontes sonoras de melhor qualidade, com licenças e
  atribuições registradas;
- disponibilizar parâmetros musicais de envelope, incluindo attack, por meio
  de controles simples ou perfis de instrumento;
- implementar reverb como primeiro efeito espacial, com controle compreensível
  e possibilidade de desligar;
- manter composição assistida, explicação harmônica e decisão do usuário como
  fluxo central da interface;
- revisar navegação e organização das páginas para aproximar criação,
  orientação e escuta;
- adicionar documentação de referências, decisões, arquitetura de áudio,
  licenças, verificação auditiva e limitações;
- registrar a entrega verificada em `config/dev_reports.yml`.

## Fora de escopo nesta etapa

- Criar uma DAW de produção profissional ou reproduzir todas as funções do
  openDAW.
- Criar mixer completo, cadeia arbitrária de plugins, automação avançada,
  gravação ao vivo, colaboração, MIDI hardware, exportação multiformato ou
  análise de áudio.
- Reescrever o domínio musical ou substituir o formato JSON antes de uma
  justificativa de compatibilidade.
- Acrescentar vários efeitos sem demonstrar que o primeiro melhora a
  experiência de composição e escuta.

## Critérios de sucesso

- Uma composição persistida atual é reproduzida pelo novo núcleo com andamento,
  durações, faixas, volume, mute/solo e loop preservados.
- O usuário consegue comparar a composição sem efeito e com reverb, ajustar o
  envelope do instrumento quando suportado e ouvir o resultado sem cliques,
  duplicação de eventos ou perda de sincronização observável.
- Uma sugestão harmônica pode ser compreendida, aplicada ou rejeitada, e sua
  consequência é audível na mesma composição.
- A interface orienta o fluxo de compor, entender e escutar sem exigir que a
  pessoa conheça os detalhes internos da DAW.
- Código, dependências e assets incorporados têm licenças e créditos
  registrados; o plano de publicação compatível com AGPL está documentado.
- Testes automatizados cobrem conversão, eventos e estados de áudio; uma
  verificação manual documenta comportamento e qualidade percebida em
  navegadores-alvo.

## Riscos e decisões

- O SDK pode impor uma migração parcial do pipeline de assets e do build, hoje
  baseado em Importmap, para resolver módulos, WASM, worker e worklet.
- Os cabeçalhos COOP/COEP necessários ao engine podem alterar o comportamento
  de recursos cross-origin usados por outras páginas.
- O SDK é publicado em versões `0.0.x`; a integração deve fixar uma versão e
  registrar o custo de acompanhar mudanças de API.
- A estrutura de sessão do SDK pode divergir do contrato Rails e gerar duas
  representações que precisam de sincronização.
- A licença AGPL pode aplicar obrigações ao trabalho combinado; a fronteira
  jurídica depende da forma concreta de integração. Este documento não é
  parecer jurídico.
- Um motor mais robusto não garante timbres melhores. A seleção e licença dos
  instrumentos e samples precisam ser avaliadas separadamente.
- A expansão da base de DAW pode consumir o prazo do TCC; cada recurso deve
  sustentar o fluxo de composição assistida e aprendizagem.

## Alternativas consideradas

| Abordagem | Vantagem | Custo ou limite |
|---|---|---|
| Adotar o SDK headless do openDAW | Maior potencial de reaproveitar uma base de DAW e reduzir código de transporte/engine | AGPL, build mais complexo e adaptação do contrato atual |
| Usar Elementary Audio como engine | Licença MIT e foco em síntese/processamento declarativo | Não entrega modelo de sessão, timeline ou editor; reaproveita menos recursos de DAW |
| Construir sobre Web Audio/AudioWorklet e WAM | Controle arquitetural e possibilidade de módulos de efeito | Mantém alto custo de implementar e manter a base genérica |

O openDAW SDK é a recomendação para a prova inicial, não uma decisão irreversível
de adoção. A decisão definitiva depende dos critérios da prova de compatibilidade.

## Fontes primárias consultadas

- openDAW: https://github.com/andremichelle/openDAW
- openDAW headless: https://github.com/andremichelle/opendaw-headless
- GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.en.html
- Elementary Audio: https://github.com/elemaudio/elementary
- Web Audio Modules API: https://github.com/webaudiomodules/api
- AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
