# Assistência à composição — desenho da primeira versão

## Objetivo

Oferecer a iniciantes contexto musical declarado, campo harmônico e possibilidades de acordes baseadas nas notas reais da composição. A pessoa conserva o controle de suas notas e do contexto. Não há inferência automática, geração, análise de áudio nem substituição automática.

## Contrato e domínio

`Music::Composition` aceita `context` opcional no JSON versão 1. Quando ausente, o documento mantém o formato anterior. Quando presente, contém `tonic` (classe escrita, sem oitava, como `C` ou `Bb`) e `mode` (`major` ou `natural_minor`). O campo harmônico é derivado em Ruby de `ScalePattern`, `Scale`, `Chord` e `Note`, sem persistir acordes calculados. As tríades são diatônicas: maior `I ii iii IV V vi vii°`; menor natural `i ii° III iv v VI VII`. As funções tônica, predominante e dominante são rótulos didáticos simplificados; no menor natural, `v` é menor e não carrega a sensível da menor harmônica.

`Music::CompositionAssistant` recebe o documento validado e IDs de faixa, região e notas selecionadas. Devolve uma projeção de leitura com campo, notas fora da escala e sugestões. Sugestões ordenam acordes pela quantidade de notas selecionadas cujas classes de altura pertencem à tríade, sem exigir que todas coincidam. Notas de bateria ficam sem análise tonal, com estado próprio, mas não escondem o campo declarado para a composição. Uma interface pequena para fontes de sugestões recebe campo, seleção e região; a fonte inicial é determinística e usa o campo harmônico.

## Aplicação

Um botão explícito adiciona as três notas da tríade à região selecionada, no início da primeira nota selecionada, ou no início da região quando só a região estiver ativa. A duração é a da primeira nota selecionada ou uma semínima, limitada pelo fim da região. A oitava de referência é a da primeira nota selecionada ou a região de C4 quando só houver seleção de região. Eventos já existentes com a mesma altura e início não são duplicados. As notas anteriores, demais regiões, faixas e instrumentos são preservados. A ação entra no histórico local existente e no autosave existente; a renderização sonora continua consumindo o documento MIDI.

## Fluxo e interface

O formulário oferece tônica, modo e “Sem contexto”. O endpoint da composição valida e persiste o JSON sob autorização do proprietário e `lock_version`. Uma leitura de assistência calcula o resultado a partir do documento atual, inclusive alterações ainda em memória. O editor mostra painel separado com campo harmônico por função, nome e notas do acorde, situação da seleção e possibilidades. Mudança de contexto, região ou notas invalida a leitura anterior; respostas atrasadas não substituem a análise atual. O painel usa rótulos e indicadores além da cor. CSS usa tokens distintos para tema claro e escuro. A view principal só compõe partials; a regra musical fica no domínio.

## Limites e verificação

Não há novas dependências, tabelas ou migrações. O contrato `version: 1` é preservado por compatibilidade. Testes cobrem contexto ausente/válido/inválido, campo maior e menor, grafia, função, notas fora da escala, sugestão conforme seleção, não mutação sem aplicação, aplicação explícita, autorização, persistência, conflito e apresentação nos dois temas. Inspeção visual verifica painel, piano roll e estados acessíveis. Registros de entrega entram em `config/dev_reports.yml` após verificação.
