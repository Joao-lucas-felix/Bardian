# Piano roll persistido por região — desenho da Fase 4

Data: 15 de outubro de 2026. Estado: desenho para revisão antes do plano.

## Intenção e resultado verificável

Uma pessoa autenticada seleciona uma região MIDI em sua composição, cria e
edita notas no piano roll, salva, sai e reabre a composição sem perda de notas.
O editor deve respeitar a duração musical da região e o compasso declarado.
O início do Caminho do Bardo e `/criar` permanecem disponíveis; este último
continua um rascunho temporário, salvo se um ajuste pontual no componente
compartilhado for necessário. A etapa não cria um segundo editor nem altera o
formato persistido da composição.

## Abordagem escolhida e alternativas

Reutilizar o piano roll Canvas atual, tornando duração e compasso parâmetros
de entrada, é a menor mudança que preserva os gestos existentes. Criar um
piano roll separado duplicaria regras de interação. Converter `/criar` no
editor persistido ampliaria o fluxo de autenticação e mudaria a experiência
pública sem necessidade para esta etapa. Nenhuma nova dependência, migração ou
reorganização geral do domínio é prevista.

## Fronteiras e dados

`Music::Composition` continua sendo o contrato validado no servidor: notas
com `id`, `pitch`, `onset_tick`, `duration_ticks` e `velocity` pertencem a uma
`MidiRegion`; o início da região é absoluto na composição, enquanto o início
da nota é relativo a ela. Uma semínima equivale a 480 ticks. O documento JSON
versionado em `Composition` continua sendo a única fonte de verdade para
salvamento. Canvas, zoom, rolagem e seleção não entram nesse documento.

A timeline identifica a região ativa por `trackId` e `regionId`, apresenta
seu nome e monta um único piano roll abaixo da timeline. Uma camada de
adaptação pura converte `onset_tick`/`duration_ticks` para `onset`/`duration`
do editor e de volta, preservando IDs, pitch e velocity. Ela substitui apenas
`notes` da região ativa no documento em memória; notas de outras regiões e
faixas permanecem intactas. Eventos do editor informam mudanças à timeline,
que marca o documento como pendente. O botão atual envia o documento completo
com `lock_version`; conflitos 409 e erros 422 preservam o estado local.

IDs das notas novas no editor persistido devem ser únicos em toda a
composição, inclusive entre regiões distintas. IDs existentes não mudam ao
abrir, editar, desfazer ou salvar. O rascunho `/criar` pode manter sua geração
local de IDs enquanto não usa o contrato persistido.

## Tempo, limites e casos de borda

O piano roll recebe `duration_ticks` exato da região e numerador e
denominador do compasso. Régua, grade, rótulos acessíveis, limites de criação,
movimento e redimensionamento são derivados desses valores, em vez de quatro
compassos fixos em 4/4. Um último compasso parcial pode ser exibido, mas
nenhuma nota pode ultrapassar o fim real da região. Mudar BPM não altera os
ticks. Mudar o compasso altera a interpretação visual da grade sem deslocar
as notas salvas. Redimensionar uma região não pode cortar notas existentes,
conforme a regra da timeline já implementada.

O contrato Ruby aceita pitches MIDI 0–127. O piano roll persistido não pode
descartar silenciosamente notas fora da faixa visual atual (36–84); deve
exibi-las ou oferecer uma visualização equivalente que permita preservá-las.
Na faixa de bateria, a vista de três peças pode continuar como atalho para
36/38/42, mas eventos de outros pitches não podem ser apagados ao reabrir ou
salvar. Dados inválidos recebidos do servidor não devem ser transformados em
um documento truncado para salvamento: a tela informa erro e bloqueia a
edição daquela região até haver correção.

## Desfazer e refazer

O histórico de notas é local à sessão e separado por `regionId`. Um controle
de velocity para notas selecionadas ficará na barra do piano roll. Cada gesto
concluído — desenhar, mover, redimensionar, alterar duração ou velocity,
excluir, inclusive uma operação em grupo — gera no máximo um passo. Enquanto
o ponteiro se move, a prévia pode mudar no documento, mas não empilha dezenas
de estados. O editor sinaliza a conclusão do gesto separadamente da prévia;
o histórico registra somente o estado concluído.
Botões e atalhos Ctrl/Cmd+Z e Ctrl/Cmd+Shift+Z permitem desfazer/refazer.
Uma nova edição após desfazer elimina apenas o ramo futuro daquela região.
Trocar de região conserva seu histórico enquanto a página estiver aberta;
excluir a região o descarta. Desfazer após salvar volta a marcar a composição
como pendente, exigindo novo salvamento. O histórico não cobre, nesta etapa,
reordenação de faixas, metadados ou remoção de regiões.

## Composição da view e responsabilidades

`show.html.erb` segue como estrutura da página: metadados, partial da
timeline e um partial do editor da região ativa. O partial novo recebe apenas
dados de apresentação e o template reutilizável do piano roll, sem consultas,
autorização ou conversão musical. O controller Rails continua responsável por
autenticação e leitura/gravação; o modelo musical Ruby continua validando o
documento. O controller Stimulus da composição coordena seleção, documento e
salvamento; funções JavaScript puras concentram conversão e histórico; o
controller do piano roll trata gestos, Canvas e seu áudio individual.

O editor da região ativa fica fora do container reconstruído pela timeline
para não perder foco, viewport ou reprodução a cada edição. Ao trocar de
região, a reprodução individual anterior para; se a faixa ou região ativa
for excluída, o editor fecha. O instrumento da faixa define a prévia
individual onde o áudio atual permitir. Reprodução simultânea, transporte
global e mixer pertencem à Fase 5.

## Testes e critério de aceite

- Testes puros verificam conversão ida/volta sem alterar outros eventos,
  IDs únicos, limites temporais, compasso variável e histórico por região.
- Testes do piano roll verificam notas fora de 36–84, última medida parcial,
  eventos de bateria fora das três peças, gestos e atalhos de histórico.
- Testes do controller da composição verificam seleção, troca/exclusão da
  região ativa, estado pendente, salvamento, conflito e resposta tardia.
- Testes Rails verificam renderização do editor, contrato JSON e reabertura
  com notas editadas; regressões cobrem `/criar`, autenticação e Caminho do
  Bardo. Uma verificação manual no navegador cobre foco, arraste, zoom,
  teclado, tema e recarga após salvar.

A etapa termina quando uma nota criada, movida, redimensionada ou excluída
numa região reaparece corretamente após salvar e reabrir; as demais regiões
ficam iguais, e desfazer/refazer atua durante a sessão. A documentação e o
DevReport serão atualizados após implementação e verificação.
