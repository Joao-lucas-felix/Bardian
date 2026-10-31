# Harmonia guiada — especificação da primeira versão

## Propósito e recorte aprovado

Uma pessoa que conhece cifras, mas não domina produção musical, deve conseguir ouvir acordes de um campo harmônico, colocá-los em sequência e perceber possibilidades de preparação, tensão e resolução. A nova experiência fica na rota pública `/harmonia`, separada de `/compositions/:id`, da dashboard administrativa e do protótipo `/criar`. A imagem fornecida inspira a organização circular dos sete acordes, não define pixels, cores ou comportamento exato.

A sessão vive apenas na memória da página: não cria composição no banco, não usa conta e não sobrevive a recarregamento ou saída. A página informa essa limitação antes da primeira edição e avisa ao sair quando houver acordes. O gerenciamento de composições, exportação e conexão com o editor completo ficam para uma etapa posterior.

## Experiência da página

O primeiro acesso abre um exemplo **Dó maior**, explicitamente rotulado como ponto de partida editável; não há inferência de tonalidade. A pessoa pode escolher qualquer tônica e os modos maior ou menor natural já suportados pelo domínio. Pode escolher um instrumento melódico do catálogo atual; bateria fica fora da lista por não executar tríades. O andamento inicial é 120 BPM e a métrica da etapa é 4/4.

A view principal compõe quatro blocos com responsabilidades próprias: controles de contexto e instrumento; roda de sete acordes; faixa harmônica por compasso e tempo; e prévia de geração. Cada acorde da roda é um botão com cifra, grau e rótulo textual de função. Clicar seleciona e toca a tríade no instrumento escolhido. Um botão separado **Adicionar ao próximo tempo** grava as três notas na faixa. Assim, explorar um som não muda a progressão. No celular, os mesmos acordes permanecem em controles grandes e acessíveis; a apresentação circular pode se reorganizar sem perder a ordem nem depender exclusivamente de cor.

A faixa mostra quatro tempos por compasso, com um acorde por tempo. Mostra cifra, grau e estado qualitativo de cada posição, além de **Tocar progressão** e **Remover último acorde**. A página não expõe mixer, piano roll completo, arrasto de blocos ou edição individual de notas nesta etapa. Uma falha de áudio informa que a escuta está indisponível sem apagar a sequência visual.

## Representação e tempo

A única fonte de verdade musical em memória é um documento `Music::Composition` versão 1, com `context` declarado, uma `Music::Track` harmônica e uma `Music::MidiRegion`. Cada acorde é uma tríade de três `Music::NoteEvent` com o mesmo `onset_tick`, duração de 480 ticks e início no próximo múltiplo de 480 após a última posição preenchida. Assim, o quinto acorde entra no primeiro tempo do segundo compasso. A duração da região acompanha o fim dos eventos; a faixa vazia mantém uma região mínima válida. IDs são únicos e os pitches ficam no registro médio do instrumento; a prévia sonora e as notas aplicadas usam exatamente o mesmo voicing calculado pelo domínio.

O domínio interpreta a progressão agrupando eventos por tempo e comparando o conjunto de classes de altura de cada tríade com `Music::HarmonicField`. Não persiste uma segunda lista de cifras. Uma posição com notas que não correspondem a uma tríade do campo é mostrada como **fora do campo declarado**, sem perder seus eventos. Mudar tônica ou modo conserva integralmente os eventos MIDI e recalcula os rótulos. Como a primeira tela não oferece edição livre de notas, acordes aplicados nela permanecem em tempos completos e contíguos; a leitura ainda deve tratar documentos inválidos sem mutá-los.

## Tensão qualitativa e geração procedural

Os rótulos são uma heurística pedagógica contextual, não uma medida física, emocional ou universal. Nesta primeira versão, função tônica indica **repouso**, predominante indica **preparação** e dominante indica **tensão**. A transição de dominante para tônica pode ser explicada como **resolução**. No modo menor natural, o `v` menor não é apresentado como a mesma atração da dominante maior da menor harmônica. A UI explica em uma frase por que exibiu o rótulo e não usa pontuação numérica.

Um objeto de domínio independente da view oferece a interface de geração procedural. **Gerar** propõe quatro acordes quando a faixa está vazia, começando pela tônica. **Continuar** propõe quatro acordes após a sequência existente, usando o último acorde realmente reconhecido na faixa como ponto de partida. Se o último tempo não corresponde ao campo atual, a continuação fica indisponível com motivo explícito; acordes anteriores nunca são removidos. A seleção entre próximos graus utiliza transições harmônicas simples e sorteio controlável por injeção de fonte aleatória nos testes. Não promete progressão ótima, estilo específico ou avaliação estética.

Ambas as ações devolvem uma **prévia** audível e legível. Somente **Aplicar prévia** acrescenta os quatro acordes, cada um no próximo tempo; descartar a prévia não altera o documento. Qualquer alteração manual ou de contexto invalida uma prévia antiga. A geração não substitui notas, não reordena a faixa e não chama serviços de IA. Um limite explícito de 32 acordes (oito compassos) mantém a primeira interface e a análise responsivas; quando restarem menos de quatro posições, a geração é desabilitada com explicação. O usuário pode remover o último acorde e continuar compondo.

## Camadas e fluxo de dados

- `config/routes.rb` expõe `GET /harmonia` e um endpoint JSON de análise/prévia, sem persistência.
- Um controller dedicado coordena o documento recebido, valida a estrutura e devolve erros claros. Ele não monta acordes nem decide tensão.
- Objetos em `app/models/music/` reutilizam `MusicalContext`, `HarmonicField`, `Composition`, `Track`, `MidiRegion` e `NoteEvent` para voicing, leitura da faixa, explicações e geração.
- Um controller Stimulus mantém o documento da sessão, apresenta roda/faixa/prévia e usa o catálogo e a reprodução de áudio existentes. Ele só converte ações explícitas em novos eventos MIDI; não replica regras de campo harmônico ou tensão.
- `app/views/harmony/show.html.erb` compõe partials para controles, roda, faixa e prévia. Partials recebem dados de apresentação; não fazem consultas, autorização ou teoria musical. CSS usa os tokens dos temas claro e escuro e indicadores textuais além da cor.

O endpoint só aceita uma composição de sessão com uma faixa harmônica, uma região e contexto válido; rejeita estruturas, IDs, tempo ou pitches inválidos antes de calcular. O POST usa proteção CSRF normal. Não há tabela, migração nem dependência nova.

## Verificação e limites

Testes Ruby cobrem os dois modos, voicings, leitura de acordes a partir das notas MIDI, posições fora do campo, tempos 1–4 e passagem para o compasso seguinte, funções/explicações de tensão, início e continuação procedural determinísticos, limite da faixa, preservação de eventos e rejeição de documentos inválidos. Testes de controller cobrem rota pública, contrato JSON, ausência de gravação e erros. Testes JavaScript cobrem escuta no instrumento selecionado, prévia sem mutação, aplicação explícita, remoção do último acorde, invalidação de prévia e falha de áudio. A inspeção visual cobre roda, faixa, estados vazios e de erro, teclado, telas estreitas e temas claro/escuro. Após verificação, a entrega entra em `config/dev_reports.yml`.

Não entram nesta versão: salvamento, autenticação, gerenciamento de composições, edição livre de MIDI, inversões e extensões de acordes, geração de melodia/baixo/bateria, medição objetiva de tensão, IA, exportação, efeitos ou mixer.
