# Contrato musical do MVP 1

Data: 15 de outubro de 2026. Estado: implementado e testado em memória.

## Responsabilidade

`Music::Composition` é a raiz da representação que poderá ser consumida pelo
editor, pela reprodução e pela persistência. Ela contém faixas ordenadas;
cada faixa contém regiões MIDI; cada região contém notas. Esses objetos Ruby
são imutáveis e não dependem de Canvas, Tone.js ou Active Record.

Esta etapa entrega validação e reconstrução em memória. Ela não cria tabelas,
rotas, arquivos MIDI nem integração com o editor atual. O início do Caminho do
Bardo em `/caminho-do-bardo/notas` permanece disponível.

## Convenções aprovadas para a etapa

- Uma semínima equivale a **480 ticks**, como no piano roll existente.
- `bpm` determina a conversão futura de ticks para segundos; mudar o andamento
  não altera a posição ou a duração musical dos eventos.
- `time_signature` guarda numerador e denominador. A duração de uma batida é
  `480 × 4 / denominador` ticks. A versão atual aceita denominadores de 1 a 64
  que sejam potências de dois.
- A ordem das faixas e das regiões é a ordem das respectivas listas.
- `start_tick` de uma região é absoluto na composição. `onset_tick` de uma nota
  é relativo ao início de sua região. Uma nota deve caber por inteiro nela.
- `pitch` usa o número MIDI de 0 a 127; `velocity` usa 1 a 127. O contrato
  não escolhe uma grafia enarmônica a partir de `pitch`.
- `instrument_id` é um identificador estável, sem vínculo ainda com um catálogo
  ou arquivo de áudio. `volume` é normalizado entre 0 e 1.
- IDs de composição, faixas, regiões e notas são strings não vazias e únicos
  dentro de uma composição. A estratégia de geração de IDs pertence à etapa
  de edição/persistência.

## Formato transportável

`to_h` produz um hash com chaves textuais e `version: 1`; `from_h` valida e
reconstrói esse hash depois de uma passagem por JSON. Exemplo mínimo:

```json
{
  "version": 1,
  "id": "song-1",
  "name": "Ideia",
  "bpm": 96,
  "time_signature": { "numerator": 4, "denominator": 4 },
  "tracks": []
}
```

Uma faixa inclui `id`, `name`, `instrument_id`, `volume`, `mute`, `solo` e
`regions`. Uma região inclui `id`, `start_tick`, `duration_ticks` e `notes`.
Uma nota inclui `id`, `pitch`, `onset_tick`, `duration_ticks` e `velocity`.

O documento versão 1 também pode incluir `loop: { start_tick, end_tick }`.
Os dois marcadores são inteiros absolutos, com `0 <= start_tick < end_tick`.
O campo é opcional: documentos anteriores sem `loop` continuam válidos e
permanecem sem ele após leitura e salvamento, até que a pessoa ajuste os
marcadores. Um loop explícito pode terminar após a última região para incluir
silêncio. A duração automática de reprodução, quando o campo está ausente,
é calculada pelo cliente a partir das regiões e não é gravada no documento.

O documento versão 1 pode incluir `context: { tonic, mode }`, declarado
pela pessoa. `tonic` é uma classe escrita sem oitava dentre as doze grafias
disponíveis no editor (`C`, `C#`, `D`, `Eb`, `E`, `F`, `F#`, `G`, `Ab`, `A`, `Bb`,
`B`). `mode` é `major` ou `natural_minor`. A ausência da chave preserva
composições antigas e não implica inferência tonal. O campo harmônico,
funções, análise de notas e sugestões são projeções temporárias, nunca
persistidas. A reprodução continua a ler os mesmos eventos MIDI.

Este formato também é armazenado como documento JSON de cada composição no
SQLite. O fluxo HTTP e o controle de versões estão descritos em
[persistencia-composicoes-mvp1.md](persistencia-composicoes-mvp1.md).
Mudanças incompatíveis no formato exigirão uma nova versão e uma estratégia
explícita de migração dos dados salvos.

## Verificação e limites

O teste `test/models/music/composition_test.rb` cobre composição vazia,
reconstrução após JSON, simultaneidade, ordem, regiões vazias, proteção contra
mutação externa, IDs duplicados e valores MIDI/temporais inválidos.

O domínio Ruby usa `Note` para preservar a grafia musical e `NoteEvent` para
os eventos MIDI. A assistência só apresenta funções e notas fora da escala
quando há contexto declarado; faixas de bateria não recebem análise tonal.
O editor Canvas continua a consumir os mesmos eventos e destaca notas fora
da escala sem modificá-las.

## Rascunho guiado de harmonia

`GET /harmonia` usa o mesmo documento versão 1, mas o mantém somente na memória
do navegador. O exemplo inicial declara `context: { tonic: "C", mode: "major" }`,
uma faixa harmônica de piano, uma região MIDI vazia, 4/4 e 120 BPM. Não há
salvamento nem integração com as composições persistidas nesta etapa; sair ou
recarregar elimina o rascunho.

Cada acorde aplicado ocupa o próximo tempo de 480 ticks com três `NoteEvent`
de duração igual. O quinto acorde começa no tick 1920, primeiro tempo do
segundo compasso. A faixa comporta até 32 acordes. Cifra, grau e tensão são
projeções de leitura das notas reais, não um segundo armazenamento musical.

`POST /harmonia/assist` recebe `{ document, operation }`, onde `operation` é
`analyze`, `generate` ou `continue`, e devolve `{ state, preview }`. `state`
contém sete opções do campo, posições lidas da faixa, próximo tick e ações
disponíveis. `preview` é `null` para análise ou quatro opções com `onset_tick`
para geração/continuação. A resposta não altera o documento; só os comandos
explícitos da interface criam eventos MIDI. Documentos inválidos retornam 422
com `{ error }`.

## Declaração harmônica persistida

O documento versão 1 pode incluir `harmony: { blocks: [...] }`. Cada bloco
declara `id`, `onset_tick`, `duration_ticks` e `chord: { root, quality }`.
Blocos são contíguos desde o tick zero, têm IDs globalmente únicos e durações
de 240, 480, 960 ou 1920 ticks; `quality` aceita `major`, `minor` e
`diminished`. A chave ausente continua significando documento legado; uma lista
vazia é uma declaração explícita vazia. `null`, campos desconhecidos, lacunas,
sobreposições e notas que iniciam fora de um bloco declarado são rejeitados.

O contrato escrito não substitui as notas MIDI. As duas faixas gerenciadas
possuem IDs `harmony-<id>` e `harmony-extra-<id>`; faixas alheias são preservadas
no merge. A faixa adicional conserva onsets absolutos. Reduzir um bloco não
trunca notas: o pedido falha se algum início sair de seu intervalo, mas uma
cauda sustentada pode ultrapassar seu fim. Remover um bloco remove sua
realização, e desfazer restaura as duas partes. Atualizações usam
`lock_version`; o cursor não é persistido.

Na reabertura de documentos sem declaração, a recuperação pode propor uma
partição somente se a sequência tonal for única. O GET não salva a proposta;
casos ambíguos ficam intactos para seleção manual. Uma vez persistida a chave
`harmony`, inclusive com `blocks: []`, nenhuma recuperação automática ocorre.
