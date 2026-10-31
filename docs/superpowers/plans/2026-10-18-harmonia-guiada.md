# Harmonia guiada Implementation Plan

> **Para agentes implementadores:** usar `superpowers:subagent-driven-development` ou `superpowers:executing-plans` tarefa por tarefa. Marcar os passos `- [ ]` conforme forem verificados.

**Objetivo:** Entregar `/harmonia` como uma página pública e temporária para ouvir tríades, montar uma faixa MIDI por tempos e criar ou continuar uma progressão procedural mediante confirmação.

**Arquitetura:** Objetos Ruby reutilizam o domínio musical para reconhecer os acordes da faixa, explicar tensão e gerar uma prévia. Um endpoint JSON lê o documento atual, sem persistência. Stimulus mantém o documento em memória, aplica apenas ações explícitas e reutiliza a borda de áudio e o transporte existentes.

**Tecnologias:** Rails, Ruby, ERB, Stimulus, JavaScript, CSS, JSON musical versão 1 e Tone.js já presente no projeto.

**Especificação:** `docs/superpowers/specs/2026-10-18-harmonia-guiada-design.md`.

## Restrições globais

- Preservar o worktree sujo e não refatorar `/compositions/:id`, `/criar` ou a dashboard administrativa.
- `/harmonia` é pública, sem banco, sessão Rails, novas dependências ou migrações; um reload perde a progressão.
- Iniciar com Dó maior explicitamente identificado, 4/4, 120 BPM, um acorde por tempo de 480 ticks, até 32 acordes.
- Reutilizar `Music::HarmonicField`, `Music::Composition`, `Music::Track`, `Music::MidiRegion`, `Music::NoteEvent` e o catálogo de instrumentos, excluindo bateria.
- Ruby concentra formação, reconhecimento, função, explicação e geração. JavaScript não reconstrói o campo harmônico.
- Comentar e documentar código novo em português; views e partials só apresentam dados e interações.
- Registrar a funcionalidade no DevReport somente após testes e inspeção visual.
- Planejar commits isolados por tarefa; se `.git` continuar somente leitura, não misturar alterações existentes e relatar a limitação.

## Foco de revisão

1. Documento com três notas corretas, mas em oitavas diferentes: reconhecer pelas classes de altura; teste na Tarefa 1.
2. Último acorde fora do campo após mudança de tonalidade: preservar MIDI e bloquear só a continuação; testes nas Tarefas 1 e 2.
3. Resposta de análise/prévia atrasada após nova seleção ou contexto: ignorá-la e não habilitar aplicação; teste na Tarefa 4.
4. Falha de sample ou Web Audio: manter documento e controles visuais, mostrando erro; teste na Tarefa 4.
5. Trigésimo segundo acorde e tentativa de gerar quatro além do limite: não truncar nem substituir notas; testes nas Tarefas 1–3.

## Mapa de arquivos e responsabilidades

- Criar `app/models/music/harmony_lane.rb`: validar a forma de sessão e projetar roda, tempos, rótulos e capacidade a partir da composição.
- Criar `app/models/music/harmony_generator.rb`: propor quatro graus conforme o último acorde, com aleatoriedade injetável.
- Criar `app/controllers/harmony_controller.rb`, `app/views/harmony/show.html.erb` inicial e alterar `config/routes.rb`: GET da página e POST JSON de leitura/prévia, sem persistência.
- Criar `app/javascript/composition/harmony_draft.js`: acrescentar/remover eventos explícitos no documento em memória, sem regras tonais.
- Criar `app/javascript/controllers/harmony_controller.js`: ciclo de UI, chamadas, áudio, invalidação de prévia e aviso ao sair.
- Completar `app/views/harmony/show.html.erb` e criar partials `_controls`, `_chord_wheel`, `_lane`, `_preview`: composição e apresentação da página; cada partial recebe somente dados da view e alvos Stimulus.
- Criar `app/assets/stylesheets/harmony.css` e modificar pontualmente `app/views/shared/_product_navigation.html.erb`: estilo nos dois temas e acesso à nova rota.
- Criar `test/models/music/harmony_lane_test.rb`, `test/models/music/harmony_generator_test.rb`, `test/controllers/harmony_controller_test.rb`, `test/javascript/harmony_draft_test.mjs`, `test/javascript/harmony_controller_test.mjs`.
- Atualizar `docs/contrato-musical-mvp1.md` apenas para esclarecer o uso temporário do contrato; acrescentar DevReport após verificação.

---

### Task 1: Leitura musical da faixa

**Arquivos:** criar `app/models/music/harmony_lane.rb`; testar em `test/models/music/harmony_lane_test.rb`.

**Interface:** `Music::HarmonyLane.new(composition)` valida uma faixa, uma região iniciada no tick zero, contexto válido e instrumento não percussivo. `#options` devolve sete hashes JSON (`index`, `degree`, `symbol`, `function`, `notes`, `pitches`). `#slots` devolve posições por batida (`onset_tick`, `degree`, `symbol`, `tension`, `explanation`; grau/cifra nulos se fora do campo). `#next_onset_tick` e `#can_append?(count)` controlam os 32 tempos. `#to_h` reúne `options`, `slots`, `next_onset_tick`, `can_append`, `can_generate`, `can_continue` e `continue_reason` para a UI. Pitches de cada opção são tríades em posição fundamental próximas de C4, sem duplicar a construção de acordes.

- [ ] **Teste que falha:** nomear casos de C maior, oitavas distintas, tempo, tensão, menor natural, mudança de contexto, limite e documento inválido. Asserções centrais: `assert_equal 7, lane.options.length`, `assert_equal "I", lane.slots.first.fetch("degree")`, `assert_equal 1920, lane.next_onset_tick` após quatro tríades, `assert_equal "resolução", lane.slots.last.fetch("tension")` após V→I, `refute lane.can_append?(1)` após 32 tempos e `assert_equal pitches_before, composition.tracks.first.regions.first.notes.map(&:pitch)` após trocar contexto. C/E/G em oitavas distintas deve ser reconhecido pelas classes; um conjunto não diatônico deve ter grau nulo e texto “fora do campo”.
- [ ] **Executar:** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/models/music/harmony_lane_test.rb`; esperado: falha por classe ausente.
- [ ] **Implementar:** classe e métodos acima usando `HarmonicField` e `Composition`, sem alterar `HarmonicField` para regras exclusivas da página. Agrupar notas pelo `onset_tick` em múltiplos de 480; comparar classes de altura sem oitava; não modificar o documento de entrada.
- [ ] **Executar:** mesmo comando; esperado: zero falhas.
- [ ] **Commit isolado:** `git add app/models/music/harmony_lane.rb test/models/music/harmony_lane_test.rb && git commit -m "feat: read guided harmony from MIDI lane"` se `.git` estiver gravável.

### Task 2: Prévia procedural de quatro acordes

**Arquivos:** criar `app/models/music/harmony_generator.rb`; testar em `test/models/music/harmony_generator_test.rb`.

**Interface:** `Music::HarmonyGenerator.new(lane, random: Random.new).preview(mode:)` recebe `mode: :generate` para faixa vazia ou `:continue` para faixa com último grau reconhecido e devolve quatro opções da interface `HarmonyLane#options`, acrescidas de `onset_tick`. Não recebe nem devolve um documento alterado.

- [ ] **Teste que falha:** `assert_equal [0, 480, 960, 1440], preview.map { |item| item.fetch("onset_tick") }`, `assert_equal "I", preview.first.fetch("degree")` para `:generate`, e `assert_equal lane.next_onset_tick, preview.first.fetch("onset_tick")` para `:continue`. Usar um objeto fake com `rand(max)` fixo para comparar duas prévias. `assert_raises(ArgumentError)` cobre último slot fora do campo, modo incompatível e menos de quatro posições; `assert_equal before, composition.to_h` prova que a prévia não edita.
- [ ] **Executar:** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/models/music/harmony_generator_test.rb`; esperado: falha por classe ausente.
- [ ] **Implementar:** transições simples por função (tônica pode preparar ou tensionar, predominante conduz preferencialmente à dominante, dominante favorece retorno à tônica), com sorteio injetado por `#rand`; usar apenas opções já calculadas pelo campo e respeitar 32 posições. Explicar o caráter heurístico, sem pontuação numérica.
- [ ] **Executar:** mesmo comando; esperado: zero falhas.
- [ ] **Commit isolado:** `git add app/models/music/harmony_generator.rb test/models/music/harmony_generator_test.rb && git commit -m "feat: preview procedural harmony"` se possível.

### Task 3: Rota pública e contrato JSON sem gravação

**Arquivos:** criar `app/controllers/harmony_controller.rb`, `app/views/harmony/show.html.erb` inicial e `test/controllers/harmony_controller_test.rb`; modificar `config/routes.rb`.

**Interface:** `GET /harmonia` (`harmony_path`) monta uma composição válida vazia com `context: C major`, faixa `harmony`, região mínima e instrumento `piano`. `POST /harmonia/assist` (`assist_harmony_path`) recebe `document` e `operation` (`analyze`, `generate`, `continue`) e devolve `{state: lane.to_h, preview: [...] | null}`. Erros de validação retornam 422 com `{error: ...}`. Não há `Composition` ActiveRecord criada/alterada.

- [ ] **Teste que falha:** `get harmony_path; assert_response :success`, `assert_select "[data-harmony-context='C major']"` e `assert_no_difference("Composition.count") { post assist_harmony_path, params: { document: document, operation: "analyze" }, as: :json }`. Verificar `response.parsed_body.fetch("state").fetch("options").length == 7`. Para documento malformado, bateria, segundo track, nota fora do beat, operação desconhecida e geração no limite, exigir `:unprocessable_entity` e documento original intacto.
- [ ] **Executar:** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/harmony_controller_test.rb`; esperado: rota/controller ausentes.
- [ ] **Implementar:** somente coordenação e validação de entrada; criar uma view mínima que mostra o contexto inicial e avisa da sessão temporária, a ser composta em partials na Tarefa 5. Não transferir cálculo musical para actions. Manter CSRF Rails padrão e `as: :json` nos testes.
- [ ] **Executar:** mesmo comando; esperado: zero falhas.
- [ ] **Commit isolado:** incluir apenas rota, controller e teste se `.git` permitir.

### Task 4: Documento temporário, prévia e áudio

**Arquivos:** criar `app/javascript/composition/harmony_draft.js`, `app/javascript/controllers/harmony_controller.js`, `test/javascript/harmony_draft_test.mjs`, `test/javascript/harmony_controller_test.mjs`.

**Interface:** `appendChords(document, chords, idFactory)` clona a composição, inclui três `NoteEvent` por opção em `chord.onset_tick` com duração 480 e velocity 90, e amplia a região; `removeLastChord(document)` remove apenas as três notas do último tempo. Ao aplicar uma opção manual, o controller usa `state.next_onset_tick` recebido do domínio para preencher `onset_tick`. O controller Stimulus recebe documento inicial e URL de assistência, guarda `music`, `state`, `preview`, `revision`; expõe ações `selectChord`, `applySelected`, `play`, `removeLast`, `generate`, `continue`, `applyPreview`; usa `createCompositionAudio` e `createCompositionTransport` com loop desligado, toca as mesmas alturas da opção escolhida e chama POST após cada edição/contexto.

- [ ] **Teste que falha para o documento:** `assert.deepEqual(appendChords(empty, [c], id).tracks[0].regions[0].notes.map(n => n.onset_tick), [0, 0, 0])`, `assert.equal(fifthOnset, 1920)`, `assert.deepEqual(empty, before)`, `assert.equal(removeLastChord(five).tracks[0].regions[0].notes.length, 12)` e `assert.throws(() => appendChords(full, [c], id), /limite/)`. Conferir IDs únicos e que a prévia sozinha não chama `appendChords`.
- [ ] **Executar:** `node --test test/javascript/harmony_draft_test.mjs`; esperado: falha por módulo/funções ausentes.
- [ ] **Implementar:** funções puras com validação de onsets, pitches e capacidade; nunca inferir ou formar acorde no JavaScript.
- [ ] **Executar:** mesmo comando; esperado: zero falhas.
- [ ] **Teste que falha para o controller:** espiar `audio.loadTrack`/`audio.trigger` e comparar `music` antes/depois de clicar na roda; após `applySelected` verificar três novos eventos; após `requestPreview` verificar zero novos eventos até `applyPreview`. Trocar contexto deve tornar `preview === null` e preservar pitches. Resolver duas respostas HTTP em ordem invertida e exigir que a segunda permaneça em `state`; simular rejeição de áudio e exigir a mesma contagem de notas; verificar `dispose` e aviso de saída apenas quando há notas.
- [ ] **Executar:** `node --test test/javascript/harmony_controller_test.mjs`; esperado: falha por controller ausente.
- [ ] **Implementar:** controller com operações pequenas, status acessível e ciclo de vida do áudio; usar o documento temporário para tocar a prévia, sem atribuí-lo à progressão até confirmação.
- [ ] **Executar:** ambos os testes JavaScript; esperado: zero falhas.
- [ ] **Commit isolado:** incluir apenas os quatro arquivos da tarefa se possível.

### Task 5: Página simples, navegação e entrega

**Arquivos:** completar `app/views/harmony/show.html.erb`; criar partials `_controls.html.erb`, `_chord_wheel.html.erb`, `_lane.html.erb`, `_preview.html.erb`, `app/assets/stylesheets/harmony.css`; modificar `app/views/shared/_product_navigation.html.erb`, `docs/contrato-musical-mvp1.md`, `test/controllers/harmony_controller_test.rb` e, depois de verificado, `config/dev_reports.yml`.

**Interface:** `show` expõe um bootstrap JSON em atributo Stimulus; partials recebem valores prontos e mostram controles de tonalidade/modo/instrumento, roda, faixa por quatro tempos, prévia e aviso de perda ao sair. O link “Harmonia” aponta para `/harmonia` sem mudar a dashboard ou o editor existentes. CSS usa rótulos, estados de foco e tokens legíveis em ambos os temas.

- [ ] **Teste que falha:** `assert_select "[data-harmony-target='wheel'] button", 7`, `assert_select "select[data-harmony-target='instrument'] option[value='drums']", 0`, `assert_select "[data-action='click->harmony#applySelected']"` e seletores separados para `play`, `removeLast`, `generate`, `continue` e `applyPreview`. Verificar aviso de sessão temporária, quatro tempos vazios e link global para `/harmonia`.
- [ ] **Executar:** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/harmony_controller_test.rb`; esperado: seletores ausentes.
- [ ] **Implementar:** view principal só organiza quatro partials; dados entram por locals ou alvos Stimulus, sem consultas e sem regras de teoria. CSS da rota isolado, sem substituição do visual global.
- [ ] **Executar:** teste de controller, `PARALLEL_WORKERS=1 mise exec -- bin/rails test`, `node --test test/javascript/*.mjs`, `mise exec -- bin/rails zeitwerk:check`, `git diff --check`; esperado: todos verdes.
- [ ] **Inspecionar:** navegador em desktop e largura móvel, claro/escuro, teclado, foco, rótulos e estado de erro de áudio; no mínimo uma progressão manual e uma continuação aplicadas; revisar que nenhum ERB consulta dados ou calcula acordes.
- [ ] **Registrar:** atualizar o contrato e adicionar um DevReport apenas com a rota existente e comportamentos verificados.
- [ ] **Commit isolado:** incluir apenas arquivos desta tarefa se `.git` permitir; informar qualquer bloqueio do índice Git e preservar alterações prévias do usuário.

## Resultado da execução

As cinco tarefas foram implementadas e verificadas em 18/10/2026. A suíte Rails
com `PARALLEL_WORKERS=1`, a suíte JavaScript, `zeitwerk:check`, a renderização
desktop/móvel e os temas claro/escuro passaram. Uma progressão manual foi
continuada proceduralmente e só entrou na faixa após confirmação; o quinto
acorde apareceu no primeiro tempo do compasso 2. Os commits condicionais do
plano não foram feitos porque o índice `.git` está somente leitura neste
ambiente; as alterações permanecem no checkout, preservando o trabalho anterior.
