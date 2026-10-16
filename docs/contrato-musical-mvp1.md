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

Este formato também é armazenado como documento JSON de cada composição no
SQLite. O fluxo HTTP e o controle de versões estão descritos em
[persistencia-composicoes-mvp1.md](persistencia-composicoes-mvp1.md).
Mudanças incompatíveis no formato exigirão uma nova versão e uma estratégia
explícita de migração dos dados salvos.

## Verificação e limites

O teste `test/models/music/composition_test.rb` cobre composição vazia,
reconstrução após JSON, simultaneidade, ordem, regiões vazias, proteção contra
mutação externa, IDs duplicados e valores MIDI/temporais inválidos.

O domínio Ruby já possui `Note`, que preserva grafia musical. `NoteEvent`
representa execução MIDI e não a substitui. A futura orientação contextual
precisará de tonalidade declarada ou outra informação validada antes de afirmar
um nome ou função harmônica. O editor Canvas ainda mantém seu estado próprio;
essa integração pertence a uma etapa posterior.
