# Piano Roll Persistido por Região Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editar notas da região MIDI ativa no piano roll, salvá-las no documento musical e reencontrá-las ao reabrir a composição.

**Architecture:** O documento JSON da composição permanece como fonte de verdade. Funções puras convertem e validam notas e guardam o histórico; a timeline coordena região ativa e salvamento; o piano roll existente recebe duração e compasso em vez de criar um editor paralelo. O editor fica fora da área de faixas reconstruída pela timeline.

**Tech Stack:** Rails 8.1, Stimulus, JavaScript ES modules/importmap, Canvas, `@webmusic/score`, testes Rails e `node:test` já presentes.

**Spec:** `docs/superpowers/specs/2026-10-15-piano-roll-persistido-design.md`

## Global Constraints

- Uma semínima equivale a 480 ticks; `start_tick` da região é absoluto, `onset_tick` da nota é relativo à região.
- IDs musicais são únicos em toda a composição; MIDI pitch 0–127, velocity 1–127, e a nota deve caber por inteiro na região.
- Nenhuma nova dependência, migração ou alteração do contrato JSON versão 1.
- `/criar` continua um rascunho temporário e o início do Caminho do Bardo permanece disponível.
- Os comentários/docstrings do código alterado são explicativos e em português, conforme `AGENTS.md`.
- Depois da implementação e verificação, atualizar documentação e `config/dev_reports.yml`.

## Review Focus

- Nota nova em uma segunda região: ID não colide com a primeira (Task 1, teste de geração).
- Região menor que a divisão de grade ou último compasso parcial: nenhum gesto cria nota fora do limite (Task 2, teste de borda).
- Nota MIDI fora de 36–84 ou peça de bateria fora das três linhas iniciais: permanece visível e íntegra após abrir/salvar (Task 2, teste de pitches).
- Conflito 409 enquanto há notas pendentes: documento e histórico local continuam disponíveis (Task 5, teste de conflito).
- Mudança de compasso com editor aberto: muda régua/grade, não os ticks das notas (Task 5, teste de compasso).

---

### Task 1: Adaptador puro entre `MidiRegion` e piano roll

**Files:**
- Create: `app/javascript/composition/region_notes.js`
- Create: `test/javascript/region_notes_test.mjs`

**Interfaces:**
- Consumes: `music.tracks[].regions[].notes[]` do contrato versão 1.
- Produces: `regionFor(music, trackId, regionId) -> region`, `toEditorNotes(region) -> Array<{id,pitch,onset,duration,velocity}>`, `replaceRegionNotes(music, trackId, regionId, editorNotes) -> music`, `newNoteId(music, generator) -> string`.

- [ ] **Step 1: Write failing tests.** `assert.equal(toEditorNotes(region)[0].onset, 480)` e `assert.equal(replaceRegionNotes(music, "track-1", "region-1", notes).tracks[1].regions[0].notes[0].pitch, originalPitch)`. Usar `assert.throws` para nota além da duração, pitch 128, velocity 0, ID repetido e oito colisões; gerador que colide uma vez deve produzir o ID seguinte.
- [ ] **Step 2: Run `node test/javascript/region_notes_test.mjs`.** Expected: FAIL porque o módulo ainda não existe.
- [ ] **Step 3: Implement the four exported functions.** Validar antes de copiar o documento; `newNoteId` recebe `() => string` (produção usa `crypto.randomUUID`), tenta no máximo oito vezes e lança erro se todas colidirem. Não converter coordenadas de Canvas.
- [ ] **Step 4: Run `node test/javascript/region_notes_test.mjs`.** Expected: todos os casos PASS.
- [ ] **Step 5: Commit only these files.** `git add -- app/javascript/composition/region_notes.js test/javascript/region_notes_test.mjs`; conferir `git diff --cached --check`; `git commit -m "feat: adaptar notas de regiões ao piano roll"`.

### Task 2: Duração, compasso e pitches no piano roll reutilizado

**Files:**
- Modify: `app/javascript/controllers/piano_roll_controller.js`
- Modify: `test/javascript/piano_roll_controller_test.mjs`

**Interfaces:**
- Consumes: Stimulus values `totalTicks`, `timeNumerator`, `timeDenominator`, `persistentMode`; sem valores, manter 7680 ticks e 4/4 do `/criar`.
- Produces: `measureTicks() -> integer`, régua/Score/limites derivados dos values; `displayPitches() -> number[]` inclui todo pitch existente no modo persistido. `setMusicalContext({totalTicks, numerator, denominator})` atualiza duração/compasso de uma instância aberta sem modificar notas.

- [ ] **Step 1: Write failing tests.** Para 1440 ticks em 6/8, `assert.equal(editor.measureTicks(), 1440)` e o Score contém uma medida; para 720 ticks, `assert.ok(note.onset + note.duration <= 720)` após criar/redimensionar com grade 480. `assert.deepEqual` confirma carregamento de pitches 0/127 e pitch 49 de bateria; sem values, `assert.equal(editor.totalTicks, 7680)`.
- [ ] **Step 2: Run `node test/javascript/piano_roll_controller_test.mjs`.** Expected: novos testes FAIL nas constantes fixas ou no filtro de pitches.
- [ ] **Step 3: Parametrize `connect`, `buildScore`, `drawRoll`, rótulos, `updateSummary` e limites de gestos.** `measureTicks()` usa `480 * 4 / timeDenominator`; o último compasso do Score pode ser parcial, sem permitir nota além de `totalTicks`. `setMusicalContext` recalcula régua, Score e limites e conserva os ticks das notas. No modo persistido, alturas 0–127 ficam alcançáveis; na bateria, incluir pitches existentes fora das três peças. Nunca filtrar silenciosamente nota válida recebida.
- [ ] **Step 4: Run `node test/javascript/piano_roll_controller_test.mjs` and `node test/javascript/creation_controller_test.mjs`.** Expected: novos e antigos testes PASS.
- [ ] **Step 5: Commit these files.** `git add -- app/javascript/controllers/piano_roll_controller.js test/javascript/piano_roll_controller_test.mjs`; conferir `git diff --cached --check`; `git commit -m "feat: adaptar piano roll a regiões e compassos variáveis"`.

### Task 3: Edições confirmadas, IDs globais e velocity

**Files:**
- Modify: `app/javascript/controllers/piano_roll_controller.js`
- Modify: `app/views/pages/_piano_roll.html.erb`
- Modify: `test/javascript/piano_roll_controller_test.mjs`

**Interfaces:**
- Consumes: `persistentModeValue`; no modo persistido, o piano roll despacha `piano-roll:request-note-id` com `detail: {id: null}`; a timeline preenche `detail.id` de modo síncrono usando `newNoteId(music, () => crypto.randomUUID())` da Task 1.
- Produces: evento `piano-roll:notes-changed` com snapshot para prévia (já existente), evento `piano-roll:notes-committed` uma vez por gesto concluído, `replaceNotes(notes)` para desfazer sem redisparo de evento, ação `changeVelocity(event)` para notas selecionadas.

- [ ] **Step 1: Write failing tests.** Após um arraste com dois `pointermove`, `assert.equal(events.filter((event) => event.name === "notes-committed").length, 1)`; mouse/teclado usam `detail.id` e `assert.throws` sem fornecedor. Testar confirmação para duração/velocity/exclusão, `replaceNotes` sem evento e `assert.equal(selected.velocity, 127)` após controle válido (0 deve ser ignorado).
- [ ] **Step 2: Run `node test/javascript/piano_roll_controller_test.mjs`.** Expected: novos testes FAIL por ausência de evento, API e controle.
- [ ] **Step 3: Add the minimal event boundary and velocity control.** Manter `notes-changed` usado por `/criar`; o novo evento é emitido só depois de cada operação lógica. Implementar `nextNoteIdForEditor()` com a solicitação síncrona no modo persistido e o contador atual no rascunho. Adicionar JSDoc/comentários em português e atualizar texto de ajuda da toolbar.
- [ ] **Step 4: Run `node test/javascript/piano_roll_controller_test.mjs` and `node test/javascript/creation_controller_test.mjs`.** Expected: PASS e sem regressão do rascunho.
- [ ] **Step 5: Commit the focused change.** `git add -- app/javascript/controllers/piano_roll_controller.js app/views/pages/_piano_roll.html.erb test/javascript/piano_roll_controller_test.mjs`; conferir `git diff --cached --check`; `git commit -m "feat: confirmar gestos e editar velocity no piano roll"`.

### Task 4: Histórico puro por região

**Files:**
- Create: `app/javascript/composition/note_history.js`
- Create: `test/javascript/note_history_test.mjs`

**Interfaces:**
- Consumes: arrays de snapshots `editorNotes`, indexados por `regionId` na timeline.
- Produces: `createHistory(initialNotes) -> {snapshots, index}`, `record(history, notes) -> history`, `undo(history) -> {history, notes, changed}`, `redo(history) -> {history, notes, changed}`; todos devolvem cópias e sinalizam indisponibilidade com `changed: false` sem alterar notas.

- [ ] **Step 1: Write failing tests.** `assert.deepEqual(undo(record(createHistory(initial), edited)).notes, initial)` e `assert.equal(redo(undone.history).changed, true)`; prévias não chamam `record`. Verificar IDs/velocity, `changed: false` sem passo, ramo futuro removido após nova edição e históricos independentes de duas regiões.
- [ ] **Step 2: Run `node test/javascript/note_history_test.mjs`.** Expected: FAIL por módulo ausente.
- [ ] **Step 3: Implement history as immutable snapshots with current index.** A timeline guarda `Map<regionId, history>`; este módulo não conhece DOM, Rails ou pixels.
- [ ] **Step 4: Run `node test/javascript/note_history_test.mjs`.** Expected: PASS.
- [ ] **Step 5: Commit these files.** `git add -- app/javascript/composition/note_history.js test/javascript/note_history_test.mjs`; conferir `git diff --cached --check`; `git commit -m "feat: registrar histórico local de notas por região"`.

### Task 5: Região ativa e salvamento compartilhado na composição

**Files:**
- Modify: `app/javascript/controllers/composition_timeline_controller.js`
- Modify: `app/views/compositions/show.html.erb`
- Create: `app/views/compositions/_region_editor.html.erb`
- Modify: `app/assets/stylesheets/productivity.css`
- Modify: `test/javascript/composition_timeline_controller_test.mjs`
- Modify: `test/controllers/compositions_controller_test.rb`

**Interfaces:**
- Consumes: `regionFor`, `toEditorNotes`, `replaceRegionNotes`, `newNoteId` (Task 1), `createHistory`, `record`, `undo`, `redo` (Task 4), `replaceNotes` e eventos da Task 3.
- Produces: `selectRegion(trackId, regionId)`, `provideNoteId(event)`, `notesChanged(event)`, `notesCommitted(event)`, `undoNotes()`, `redoNotes()`, `syncActiveEditor()`; mantém `music` e `lockVersion` atuais.

- [ ] **Step 1: Write failing tests.** HTML: `assert_select "[data-composition-timeline-target='regionEditor'] template"`. JS: `assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 72)` após evento e `assert.equal` da segunda região ao valor original; `provideNoteId` evita colisão. Cobrir troca/exclusão da região e descarte do seu histórico, stop de áudio, instrumento da faixa, Ctrl/Cmd+Z/Shift+Z, desfazer depois de salvar (volta a pendente), mudança de compasso sem alterar ticks, resize com editor aberto, 409/resposta tardia preservando histórico e região inválida sem salvamento truncado.
- [ ] **Step 2: Run `node test/javascript/composition_timeline_controller_test.mjs` and `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/compositions_controller_test.rb`.** Expected: novos testes FAIL pela ausência da integração.
- [ ] **Step 3: Implement selection and partial.** A view principal compõe `_region_editor` com apenas apresentação e `<template>` do partial `pages/piano_roll`; o controller monta a instância fora da lane reconstruída, passa duração/compasso/notas/instrumento e mantém `trackId` + `regionId`. No elemento pai, ações Stimulus encaminham `piano-roll:request-note-id`, `notes-changed` e `notes-committed`. `notesChanged` substitui apenas notas da região e usa `commit` existente; `notesCommitted` registra um passo. `syncActiveEditor` só remonta na troca de região; alteração de duração/compasso usa `setMusicalContext`. Undo/redo restaura pelo adaptador e `replaceNotes`. Não consultar banco nem aplicar regras musicais nas views.
- [ ] **Step 4: Run the two focused commands from Step 2.** Expected: todos PASS; conferir foco, estado vazio e estilos responsivos.
- [ ] **Step 5: Commit the integration.** Preparar só os seis arquivos desta task com `git add --`, conferir `git diff --cached --check`; `git commit -m "feat: editar notas da região ativa na composição"`.

### Task 6: Aceite da Fase 4 e registro da entrega

**Files:**
- Modify: `docs/timeline-composicoes-mvp1.md`
- Modify: `README.md`
- Modify: `config/dev_reports.yml`
- Modify: `test/models/dev_report_test.rb`
- Modify: `test/controllers/dashboard_controller_test.rb`
- Test: `test/controllers/compositions_controller_test.rb`, `test/javascript/*.mjs`

**Interfaces:**
- Consumes: fluxo completo das Tasks 1–5.
- Produces: documentação do comportamento, limites e DevReport com rota `/compositions`.

- [ ] **Step 1: Add the acceptance test.** Criar duas regiões em faixas distintas, editar uma com pitch/velocity/duração, salvar por JSON e reabrir: `assert_equal 72, response.parsed_body.dig("document", "tracks", 0, "regions", 0, "notes", 0, "pitch")` e `assert_equal original_second_region, ...`. Confirmar acesso apenas do proprietário e respostas HTTP 200 para `/criar` e `/caminho-do-bardo/notas`; executar antes das atualizações para localizar lacunas.
- [ ] **Step 2: Run complete verification.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test`, `node --test test/javascript/*.mjs`, `RUBOCOP_CACHE_ROOT=/tmp/bardian-rubocop-cache mise exec -- bin/rubocop`, `mise exec -- bin/rails zeitwerk:check`, `git diff --check`. Expected: zero falhas/ofensas.
- [ ] **Step 3: Check the editor manually in browser.** Criar região curta e 6/8, inserir/mover/redimensionar nota, desfazer/refazer, trocar região, salvar/recarregar; verificar teclado, foco, tema, zoom e estado de conflito. Registrar limitação de ambiente se não houver navegador/autenticação de teste disponível.
- [ ] **Step 4: Update docs and DevReport only after verification.** Descrever editor persistido, limites (sem reprodução multifaixa/mesclagem de conflitos) e testes; atualizar contagens dos relatórios.
- [ ] **Step 5: Re-run affected tests and commit.** Preparar só os arquivos alterados nesta task com `git add --`, conferir `git diff --cached --check`; `git commit -m "docs: registrar piano roll persistido da fase 4"`.
