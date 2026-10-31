# Reprodução da Composição com Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduzir e editar continuamente a composição inteira, com transporte multifaixa e marcadores de loop persistidos.

**Architecture:** `Music::Composition` valida um loop opcional sem mudar a versão do JSON. Funções JavaScript puras extraem eventos em ticks absolutos; um transporte controla ciclos e agenda eventos canceláveis; um adaptador Tone.js administra fontes por faixa. A timeline apresenta controles e envia o documento atual ao transporte, sem duplicar regras musicais.

**Tech Stack:** Ruby on Rails, Stimulus, JavaScript ES modules, Tone.js local, Minitest e `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-16-reproducao-composicao-loop-design.md`

## Global Constraints

- Preservar `/criar`, o piano roll individual e `/caminho-do-bardo/notas`.
- `480` ticks por semínima; início da nota relativo à região, início da região absoluto na composição.
- Documento `version: 1`; `loop` opcional com inteiros `0 <= start_tick < end_tick`; documentos antigos continuam sem o campo até edição dos marcadores.
- Usar os instrumentos locais `piano`, `strings` e `drums`; sem nova biblioteca, serviço ou migração de banco.
- Edições não param o transporte: eventos à frente entram nesta passagem, eventos atrás na próxima; notas já iniciadas não são cortadas por edições.
- Marcadores alterados durante Play passam a valer na próxima volta, sem salto; loop começa ligado, mas desligá-lo toca o arranjo inteiro uma vez.
- Todo código novo ou alterado recebe comentários e documentação explicativos em português, conforme `AGENTS.md`.
- Testes devem cobrir lógica musical, integração, regressões e comportamento audível por verificação manual; registrar a entrega em `config/dev_reports.yml` após verificar.

## Review Focus

- Documento antigo sem `loop`: abrir, salvar metadados e reabrir não deve materializar marcadores nem mudar o contrato (Task 1).
- Loop explícito além do fim da última região: a timeline deve exibir o marcador e tocar o silêncio até ele; loop vazio deve informar ausência de som (Tasks 2 e 5).
- Edição dentro da janela já agendada: nota futura movida/excluída não pode tocar no instante antigo nem disparar duas vezes (Task 5).
- Instrumento que falha ao carregar, seguido de troca de faixa ou saída da página: conclusão assíncrona atrasada não deve tocar nem recriar recursos (Tasks 3 e 6).
- Faixa em solo e mute simultaneamente, inclusive no modo faixa isolada: mute prevalece; nenhuma faixa errada deve tocar (Tasks 2 e 5).

---

### Task 1: Contrato Ruby e salvamento dos marcadores

**Files:**
- Modify: `app/models/music/composition.rb`
- Test: `test/models/music/composition_test.rb`
- Test: `test/controllers/compositions_controller_test.rb`
- Modify: `docs/contrato-musical-mvp1.md`

**Interfaces:**
- Consumes: JSON da composição `version: 1` e `lock_version` da rota JSON existente.
- Produces: `Music::Composition#loop_range` (`nil` ou hash imutável com `"start_tick"` e `"end_tick"`); `from_h` aceita `loop` ausente, `to_h` só o inclui quando explícito.

- [ ] **Step 1: Write failing tests.** `from_h(source_sem_loop).to_h == source_sem_loop`; com `{ "start_tick" => 480, "end_tick" => 2400 }`, ida/volta preserva o campo. Rejeitar início negativo, fim igual/menor, fração, string e hash incompleto. Na integração, `PATCH` JSON seguido de `GET` conserva marcadores; `PATCH` com `lock_version` antigo retorna 409 sem mudar o documento; formulário HTML preserva o loop já salvo.
- [ ] **Step 2: Run the red tests.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/models/music/composition_test.rb test/controllers/compositions_controller_test.rb`. Expected: FAIL nos novos casos de `loop`.
- [ ] **Step 3: Implement the minimal contract.** Atualizar `initialize(id:, name:, bpm:, time_signature:, tracks:, loop_range: nil)`, `from_h(data)` e `to_h` em `app/models/music/composition.rb`; validar com `Music::Contract.integer`, congelar a cópia e não adicionar valor padrão ao JSON. Documentar formato e compatibilidade em `docs/contrato-musical-mvp1.md`.
- [ ] **Step 4: Run the focused tests.** Repetir o comando do Step 2. Expected: PASS, inclusive testes antigos.
- [ ] **Step 5: Commit only this task.** `git add -- app/models/music/composition.rb test/models/music/composition_test.rb test/controllers/compositions_controller_test.rb docs/contrato-musical-mvp1.md`; `git diff --cached --check`; `git commit -m "feat: persistir marcadores de loop na composição"`.

### Task 2: Eventos puros e regras de intervalo

**Files:**
- Create: `app/javascript/composition/playback_events.js`
- Test: `test/javascript/playback_events_test.mjs`
- Modify: `app/javascript/composition/timeline_state.js`
- Test: `test/javascript/timeline_state_test.mjs`

**Interfaces:**
- Consumes: documento JSON da Task 1.
- Produces: `arrangementEndTick(music) -> number`, `loopRange(music) -> {startTick,endTick,explicit}`, `audibleTrackIds(music, isolatedTrackId = null) -> string[]`, `eventsInRange(music, startTick, endTick, isolatedTrackId = null) -> Array<{id,trackId,instrumentId,pitch,velocity,onsetTick,durationTicks}>`, `secondsPerTick(bpm) -> number`; `setLoopRange(music, startTick, endTick) -> document` e `timelineTicks(music)` incluindo o fim explícito.

- [ ] **Step 1: Write failing tests.** Duas regiões em faixas diferentes com notas no tick local 120 produzem eventos absolutos `region.start_tick + 120`; 120 BPM converte 480 ticks em 0,5 s. Testar início/fim de loop com nota que cruza a borda sem ataque duplicado, região sobreposta, velocity/ID preservados, faixa isolada, solo+mute, nenhum evento audível, fim automático seguindo região removida e fim explícito 3840 além da última região 1920. `setLoopRange` rejeita `endTick <= startTick` e não altera a entrada; compasso 6/8 muda snap para 240 ticks, não desloca um marcador já salvo.
- [ ] **Step 2: Run the red tests.** `node test/javascript/playback_events_test.mjs` e `node test/javascript/timeline_state_test.mjs`. Expected: novos testes FAIL por falta das funções.
- [ ] **Step 3: Implement pure functions.** Criar os exports com as assinaturas do bloco Interfaces. Recortar eventos por interseção com `[startTick, endTick)` usando ticks absolutos, preservando `id` e duração audível; não converter pixels nem alterar `music`. `setLoopRange` usa cópia, inteiros e `snapTick`; `timelineTicks` considera `music.loop?.end_tick` sem mudar o padrão dos documentos antigos.
- [ ] **Step 4: Run focused tests.** Repetir Step 2. Expected: PASS.
- [ ] **Step 5: Commit only this task.** `git add -- app/javascript/composition/playback_events.js test/javascript/playback_events_test.mjs app/javascript/composition/timeline_state.js test/javascript/timeline_state_test.mjs`; `git diff --cached --check`; `git commit -m "feat: extrair eventos e intervalos de reprodução"`.

### Task 3: Fonte sonora por faixa e eventos canceláveis

**Files:**
- Modify: `app/javascript/audio/phrase_instruments.js`
- Test: `test/javascript/phrase_instruments_test.mjs`
- Create: `app/javascript/audio/composition_audio.js`
- Test: `test/javascript/composition_audio_test.mjs`

**Interfaces:**
- Consumes: `instrument_id`, `volume` e `velocity` das faixas/notas; catálogo local existente.
- Produces: `createCompositionAudio() -> {start:()=>Promise<void>, pause:()=>void, stop:()=>void, now:()=>number, schedule:(callback,atSeconds)=>token, cancel:(token)=>void, loadTrack:(track)=>Promise<void>, trigger:(trackId,pitch,durationSeconds,time,velocity)=>void, setTrackVolume:(trackId,volume)=>void, silenceTrack:(trackId)=>void, disposeTrack:(trackId)=>void, dispose:()=>void}`. `createPhraseInstrument(instrumentId, {destination} = {})` mantém o uso antigo; `trigger(pitch,durationSeconds,time,velocity=1)` aceita intensidade normalizada.

- [ ] **Step 1: Write failing tests.** Fonte de piano e cordas usa os mesmos samples; bateria usa 36/38/42. Dois disparos simultâneos em faixas diferentes são independentes; velocity 127 e volume 1 não atenuam como velocity 1/volume 0; `silenceTrack` cala vozes ativas. Pitch de bateria sem sample não altera o documento e é reportado como indisponível. `schedule` devolve token e `cancel(token)` impede callback ainda pendente. Falha de uma faixa não descarta fontes carregadas de outra; `dispose` invalida load tardio. Os testes existentes do piano roll continuam exigindo seu comportamento atual.
- [ ] **Step 2: Run the red tests.** `node test/javascript/composition_audio_test.mjs` e `node test/javascript/phrase_instruments_test.mjs`. Expected: novos testes FAIL pelo módulo/API ausentes.
- [ ] **Step 3: Implement the audio boundary.** Compartilhar a configuração de samples em `phrase_instruments.js` sem alterar os caminhos; `destination` opcional recebe a saída da fonte, e a ausência dela mantém `.toDestination()`. Em `composition_audio.js`, encapsular Tone.js e nós de ganho por `trackId`, oferecer tokens canceláveis para eventos não iniciados; vozes iniciadas só são silenciadas por mute/pausa/parada ou descarte, não por edição de nota. Ignorar resposta de load após `disposeTrack`/`dispose`.
- [ ] **Step 4: Run focused tests.** Repetir Step 2. Expected: PASS e sem regressão do instrumento do piano roll.
- [ ] **Step 5: Commit only this task.** `git add -- app/javascript/audio/phrase_instruments.js test/javascript/phrase_instruments_test.mjs app/javascript/audio/composition_audio.js test/javascript/composition_audio_test.mjs`; `git diff --cached --check`; `git commit -m "feat: preparar áudio multifaixa da composição"`.

### Task 4: Transporte inicial da composição

**Files:**
- Create: `app/javascript/audio/composition_transport.js`
- Test: `test/javascript/composition_transport_test.mjs`

**Interfaces:**
- Consumes: exports da Task 2 e `createCompositionAudio()` da Task 3, injetável nos testes.
- Produces: `createCompositionTransport({audio,onState}) -> {play:(music,options?)=>Promise<void>, pause:()=>void, resume:()=>Promise<void>, stop:()=>void, update:(music)=>void, setLoopEnabled:(enabled)=>void, isolateTrack:(trackId|null)=>void, tick:()=>number, dispose:()=>void}`; `onState({status,tick,loopEnabled,unavailableTrackIds})` comunica estados à timeline. Task 4 estabelece transporte e ciclo de vida; Task 5 completa atualizações ao vivo nesses mesmos métodos.

- [ ] **Step 1: Write failing tests with fake clock/audio.** Play agenda notas de duas faixas no mesmo tempo; pause preserva tick e resume inclui somente a cauda de nota que atravessa o tick; stop volta a `loop.startTick`. Loop repete o intervalo, modo sem loop termina no fim do arranjo, faixa isolada seleciona somente seu `trackId`, composição sem eventos audíveis não inicia. Load falho de uma faixa gera aviso, mas outra toca; `dispose`/load tardio não dispara áudio.
- [ ] **Step 2: Run the red tests.** `node test/javascript/composition_transport_test.mjs`. Expected: FAIL por módulo ausente.
- [ ] **Step 3: Implement the state machine.** Usar janela curta de agendamento e `audio.schedule/cancel` para eventos ainda não iniciados; chavear eventos por `id`, `trackId` e número do ciclo. Dar implementação inicial de `update`, `setLoopEnabled` e `isolateTrack` sem reiniciar o áudio; seus casos dinâmicos são fechados na Task 5. Impedir callbacks de gerações antigas após pause/stop/dispose. Atualizar `onState.tick` enquanto toca sem reenviar toda a árvore musical; chamar `audio.pause/stop` nas transições correspondentes; separar estado `loading`, `playing`, `paused`, `stopped` e `error`.
- [ ] **Step 4: Run focused tests.** Repetir Step 2. Expected: PASS determinístico, sem timers pendurados.
- [ ] **Step 5: Commit only this task.** `git add -- app/javascript/audio/composition_transport.js test/javascript/composition_transport_test.mjs`; `git diff --cached --check`; `git commit -m "feat: reproduzir composição com transporte editável"`.

### Task 5: Atualização musical ao vivo no transporte

**Files:**
- Modify: `app/javascript/audio/composition_transport.js`
- Test: `test/javascript/composition_transport_test.mjs`

**Interfaces:**
- Consumes: `createCompositionTransport({audio,onState})` da Task 4 e o documento musical atualizado.
- Produces: sem novos métodos; completa `update(music)`, `setLoopEnabled(enabled)` e `isolateTrack(trackId|null)` preservando posição e ciclo.

- [ ] **Step 1: Write failing tests with fake clock/audio.** Edição em tick futuro substitui evento pendente e cancela o token antigo; edição em tick passado só entra na volta seguinte. Cobrir região movida, nota excluída/adicionada, undo/redo via `update`, BPM alterado sem deslocar tick, mute/solo/volume imediatos e faixa isolada; nota já soando não é cortada por editar outra nota. Marcadores e alternância de loop entram na próxima volta; mudança durante a janela agendada não duplica ataque.
- [ ] **Step 2: Run the red tests.** `node test/javascript/composition_transport_test.mjs`. Expected: novos testes FAIL nos casos de atualização.
- [ ] **Step 3: Implement dynamic updates.** `update(music)` troca a fonte de dados, compara eventos futuros por `id`/`trackId`/ciclo e cancela apenas tokens não iniciados cuja interpretação mudou; eventos em pontos já percorridos aguardam novo ciclo. Recalcular relação tick/segundo ao mudar BPM conservando tick. `setLoopEnabled` e alterações de marcador guardam o intervalo pendente até o próximo wrap. Aplicar volume/mute/solo nas fontes ativas e futuras; não chamar `stop` em edição.
- [ ] **Step 4: Run focused tests.** Repetir Step 2. Expected: PASS, inclusive os casos da Task 4.
- [ ] **Step 5: Commit only this task.** `git add -- app/javascript/audio/composition_transport.js test/javascript/composition_transport_test.mjs`; `git diff --cached --check`; `git commit -m "feat: aplicar edições durante reprodução contínua"`.

### Task 6: Controles e agulha na timeline

**Files:**
- Modify: `app/javascript/controllers/composition_timeline_controller.js`
- Modify: `app/views/compositions/_timeline.html.erb`
- Modify: `app/assets/stylesheets/productivity.css`
- Test: `test/javascript/composition_timeline_controller_test.mjs`
- Test: `test/controllers/compositions_controller_test.rb`

**Interfaces:**
- Consumes: `createCompositionTransport` das Tasks 4–5 e `setLoopRange` da Task 2.
- Produces: ações Stimulus `playComposition`, `pauseComposition`, `stopComposition`, `toggleCompositionLoop`, `playTrack`, `changeLoopMarker`; targets `transportStatus`, `playhead`, `loopStart`, `loopEnd`; nenhum cálculo musical em ERB.

- [ ] **Step 1: Write failing integration tests.** HTML autenticado contém transporte, texto `role="status"`, marcadores, agulha e ações de teclado. Controller usa `this.music` ainda não salvo; `commit`, `notesChanged`, undo/redo e metadados chamam `transport.update` sem `transport.stop`; alterar loop marca documento como pendente. Play global interrompe a prévia individual do piano roll; abrir prévia individual pausa o transporte global para não haver dois relógios concorrentes. Desconectar descarta transporte; falha de carregamento/retorno tardio não muda tela desmontada. Mute/solo/volume e faixa isolada refletem imediatamente; foco, seleção e viewport sobrevivem à atualização da agulha.
- [ ] **Step 2: Run the red tests.** `node test/javascript/composition_timeline_controller_test.mjs` e `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/compositions_controller_test.rb`. Expected: novos testes FAIL por controles ausentes.
- [ ] **Step 3: Implement the view/controller boundary.** Acrescentar controles ao partial `_timeline.html.erb` com rótulos em português, campos numéricos de marcador e alternativa por teclado; usar `show.html.erb` apenas se necessário para compor a seção. Na régua, marcadores aceitam arraste por ponteiro com snap e limites; `trackRow` recebe botão de ouvir faixa isolada. Instanciar um transporte por página após carregar o documento, enviar alterações sem remount do editor, atualizar a agulha por posição em ticks sem reconstruir as faixas e liberar recursos em `disconnect`. Posicionar marcadores respeitando `timelineTicks`; CSS responde a zoom, tema e tela estreita. Manter DOM/formulário válidos sem JavaScript.
- [ ] **Step 4: Run focused tests.** Repetir Step 2. Expected: PASS.
- [ ] **Step 5: Commit only this task.** `git add -- app/javascript/controllers/composition_timeline_controller.js app/views/compositions/_timeline.html.erb app/assets/stylesheets/productivity.css test/javascript/composition_timeline_controller_test.mjs test/controllers/compositions_controller_test.rb`; incluir `show.html.erb` somente se alterado. `git diff --cached --check`; `git commit -m "feat: controlar reprodução e loop na timeline"`.

### Task 7: Aceite, regressões e registro da entrega

**Files:**
- Modify: `docs/timeline-composicoes-mvp1.md`
- Modify: `config/dev_reports.yml`
- Modify: testes afetados pelas correções estritamente necessárias ao aceite.

**Interfaces:**
- Consumes: composição persistida da Task 1, eventos da Task 2, áudio da Task 3, transporte das Tasks 4–5 e UI da Task 6.
- Produces: fluxo demonstrável documentado e verificado, com limitações conhecidas.

- [ ] **Step 1: Add an acceptance scenario.** Salvar composição com duas faixas, loop `{start_tick:480,end_tick:2400}`, notas em regiões distintas; reabrir e confirmar os mesmos marcadores e notas. Verificar status e controles no HTML, dono autorizado, visitante redirecionado, e respostas 200 de `/criar` e `/caminho-do-bardo/notas`.
- [ ] **Step 2: Run complete automated verification.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test`, `node --test test/javascript/*.mjs`, `RUBOCOP_CACHE_ROOT=/tmp/bardian-rubocop-cache mise exec -- bin/rubocop`, `mise exec -- bin/rails zeitwerk:check`, `git diff --check`. Expected: zero falhas/ofensas.
- [ ] **Step 3: Verify in browser.** Ouvir duas faixas, mover nota à frente e atrás da agulha, confirmar atualização nesta/na próxima volta, mover marcadores com mouse/teclado, salvar/reabrir, pausar/retomar/parar, mutar/solar, ajustar volume, isolar faixa, mudar BPM, simular falha de sample; verificar tema, foco e responsividade. Registrar qualquer limitação de ambiente ou conferência auditiva não realizada.
- [ ] **Step 4: Review responsibilities and document.** Conferir que ERB/partials só apresentam dados, sem consultas ou regras musicais; registrar limites e comandos/resultados em `docs/timeline-composicoes-mvp1.md` e `config/dev_reports.yml` somente após verificação. Corrigir falhas dentro do escopo sem refatoração adjacente.
- [ ] **Step 5: Re-run affected checks and commit.** Executar testes afetados pelas correções, `git diff --check`; preparar somente documentação/testes deste task com `git add --`; `git diff --cached --check`; `git commit -m "docs: registrar reprodução contínua da composição"`.
