import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import * as state from "../../app/javascript/composition/timeline_state.js"
import * as notes from "../../app/javascript/composition/region_notes.js"
import * as history from "../../app/javascript/composition/note_history.js"
import * as playback from "../../app/javascript/composition/playback_events.js"

// Carrega o controller com Stimulus mínimo para verificar o protocolo de salvamento.
const source = readFileSync(new URL("../../app/javascript/controllers/composition_timeline_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class TimelineController extends Controller")
  .concat("\nTimelineController")
const dom = { querySelector: () => ({ content: "token" }), body: { children: [], style: { overflow: "" } } }
const browserWindow = { confirm: () => true, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout }
const INSTRUMENT_CATALOG = {
  piano: { label: "Piano", category: "pianos" }, strings: { label: "Cordas", category: "cordas" },
  drums: { label: "Bateria", category: "bateria e percussão" }
}
const Controller = vm.runInNewContext(source, {
  Controller: class {}, ...state, ...notes, ...history, ...playback, crypto: { randomUUID: (() => { let serial = 0; return () => `uuid-${++serial}` })() },
  INSTRUMENT_CATALOG,
  createCompositionAudio: () => ({}), createCompositionTransport: () => ({}),
  document: dom,
  window: browserWindow
})

/** Transporte observável sem substituir as regras musicais do controller. */
function transportSpy() {
  const calls = []
  return { calls, update(music) { calls.push(["update", music]) },
    play(music) { calls.push(["play", music]); return Promise.resolve() },
    resume() { calls.push(["resume"]); return Promise.resolve() },
    pause() { calls.push(["pause"]) }, stop() { calls.push(["stop"]) },
    setLoopEnabled(value) { calls.push(["loop", value]) },
    isolateTrack(id) { calls.push(["isolate", id]) }, dispose() { calls.push(["dispose"]) } }
}

/** Documento mínimo com duas regiões para verificar isolamento das edições. */
function editingController() {
  const controller = new Controller()
  controller.music = { id: "music", name: "Teste", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [{ id: "track", name: "Piano", instrument_id: "piano", regions: [
    { id: "one", start_tick: 0, duration_ticks: 1920, notes: [{ id: "note-one", pitch: 60, onset_tick: 0, duration_ticks: 480, velocity: 100 }] },
    { id: "two", start_tick: 1920, duration_ticks: 1920, notes: [{ id: "note-two", pitch: 65, onset_tick: 0, duration_ticks: 480, velocity: 90 }] }
  ] }] }
  controller.statusTarget = { textContent: "" }
  controller.render = () => {}
  controller.selectedTrackId = "track"
  controller.selectedRegionId = "one"
  controller.noteHistories = new Map([["one", history.createHistory(notes.toEditorNotes(controller.music.tracks[0].regions[0]))]])
  return controller
}

test("notas editadas atingem só a região ativa e desfazer volta a pendente", () => {
  const controller = editingController()
  const changed = [{ id: "note-one", pitch: 72, onset: 0, duration: 480, velocity: 127 }]
  controller.notesChanged({ detail: { notes: changed } })
  controller.notesCommitted({ detail: { notes: changed } })
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 72)
  assert.equal(controller.music.tracks[0].regions[1].notes[0].pitch, 65)
  controller.statusTarget.textContent = "Tudo salvo."
  controller.undoNotes()
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 60)
  assert.match(controller.statusTarget.textContent, /não salvas/)
})

test("ID solicitado não colide com notas de outra região", () => {
  const controller = editingController()
  const event = { detail: { id: null } }
  controller.provideNoteId(event)
  assert.notEqual(event.detail.id, "note-one")
  assert.notEqual(event.detail.id, "note-two")
})

test("nota inválida não substitui o documento nem cria revisão", () => {
  const controller = editingController()
  assert.equal(controller.revision, undefined)
  controller.notesChanged({ detail: { notes: [{ id: "x", pitch: 128, onset: 0, duration: 480, velocity: 100 }] } })
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 60)
  assert.equal(controller.revision, undefined)
  controller.notesCommitted({ detail: { notes: [{ id: "x", pitch: 128, onset: 0, duration: 480, velocity: 100 }] } })
  assert.equal(controller.noteHistories.get("one").snapshots.length, 1)
})

test("seleção sem edição não marca documento como pendente", () => {
  const controller = editingController()
  controller.notesChanged({ detail: { notes: notes.toEditorNotes(controller.music.tracks[0].regions[0]) } })
  assert.equal(controller.revision, undefined)
})

// O botão é a única operação que converte uma possibilidade em eventos MIDI.
test("sugestao exige clique e preserva a nota original", () => {
  const controller = editingController()
  controller.assistance = { suggestions: [{ pitches: [60, 64, 67], onset: 0, duration: 480 }] }
  const before = structuredClone(controller.music)
  assert.deepEqual(controller.music, before)
  controller.applySuggestion({ currentTarget: { dataset: { index: "0" } } })
  assert.deepEqual(controller.music.tracks[0].regions[0].notes.map((note) => note.pitch), [60, 64, 67])
  assert.equal(controller.music.tracks[0].regions[0].notes[0].id, "note-one")
  assert.equal(controller.noteHistories.get("one").snapshots.length, 2)
})

// Duas leituras concorrentes nunca podem devolver possibilidades da região anterior.
test("resposta atrasada nao substitui a analise da selecao recente", async () => {
  const controller = editingController()
  controller.hasAssistanceUrlValue = true
  controller.assistanceUrlValue = "/compositions/music/assistance.json"
  const pending = []
  controller.request = () => new Promise((resolve) => pending.push(resolve))
  controller.renderAssistance = () => {}
  controller.assistance = { suggestions: [{ symbol: "Am" }] }
  const first = controller.refreshAssistance()
  assert.equal(controller.assistance, null)
  const second = controller.refreshAssistance()
  pending[1]({ ok: true, json: async () => ({ status: "contextualized", suggestions: [{ symbol: "C" }] }) })
  await second
  pending[0]({ ok: true, json: async () => ({ status: "contextualized", suggestions: [{ symbol: "Dm" }] }) })
  await first
  assert.equal(controller.assistance.suggestions[0].symbol, "C")
})

// O painel usa os dados selecionados da região, mas não altera o documento persistível.
test("orientação mostra nota MIDI e distância cromática sem marcar alterações", () => {
  const controller = editingController()
  controller.guidanceTextTarget = { textContent: "" }
  controller.hasGuidanceTextTarget = true
  controller.selectionChanged({ detail: { notes: [{ name: "C4", pitch: 60, onset: 480, duration: 240, velocity: 100 }] } })
  assert.match(controller.guidanceTextTarget.textContent, /C4.*MIDI 60/)
  assert.match(controller.guidanceTextTarget.textContent, /480 ticks/)
  assert.equal(controller.revision, undefined)
  controller.selectionChanged({ detail: { notes: [
    { name: "C4", pitch: 60, onset: 0, duration: 480, velocity: 100 },
    { name: "E4", pitch: 64, onset: 0, duration: 480, velocity: 90 }
  ] } })
  assert.match(controller.guidanceTextTarget.textContent, /4 semitons/)
  assert.equal(controller.revision, undefined)
})

// Edições sucessivas devem formar um único autosave após a pausa configurada.
test("autosave agrupa edições e chama o salvamento somente após o timer", () => {
  const controller = editingController()
  controller.autosaveEnabled = true
  controller.music = { ...controller.music }
  controller.statusTarget = { textContent: "" }
  let scheduled = null
  let cleared = 0
  browserWindow.setTimeout = (callback, delay) => { assert.equal(delay, 1000); scheduled = callback; return 7 }
  browserWindow.clearTimeout = () => { cleared += 1 }
  let saves = 0
  controller.save = () => { saves += 1 }
  controller.markDirty()
  controller.markDirty()
  assert.equal(cleared, 1)
  assert.equal(saves, 0)
  scheduled()
  assert.equal(saves, 1)
  browserWindow.setTimeout = setTimeout
  browserWindow.clearTimeout = clearTimeout
})

test("troca de região interrompe áudio e preserva históricos distintos", () => {
  const controller = editingController()
  let stops = 0
  controller.activePianoRoll = () => ({ stop() { stops += 1 } })
  controller.selectRegion("track", "two")
  assert.equal(stops, 1)
  assert.equal(controller.selectedRegionId, "two")
  assert.equal(controller.noteHistories.get("one").snapshots[0][0].id, "note-one")
  assert.equal(controller.noteHistories.get("two").snapshots[0][0].id, "note-two")
})

test("região inválida recebida do servidor é bloqueada com mensagem sem truncar notas", () => {
  const controller = editingController()
  controller.music.tracks[0].regions[1].notes[0].pitch = 128
  controller.selectedRegionId = null
  controller.selectedTrackId = null
  assert.doesNotThrow(() => controller.selectRegion("track", "two"))
  assert.equal(controller.selectedRegionId, null)
  assert.match(controller.statusTarget.textContent, /Região.*inválid|não.*edit/i)
  assert.equal(controller.music.tracks[0].regions[1].notes[0].pitch, 128)
})

test("remoção descarta histórico da região excluída", () => {
  const controller = editingController()
  controller.render = () => Controller.prototype.render.call(controller)
  controller.summaryTarget = { textContent: "" }
  controller.emptyTarget = { hidden: false }
  controller.zoomLabelTarget = { textContent: "" }
  controller.rulerTarget = { replaceChildren() {}, append() {} }
  controller.tracksTarget = { replaceChildren() {} }
  controller.element = () => ({ style: {}, append() {}, textContent: "" })
  controller.trackRow = () => ({})
  controller.syncActiveEditor = () => {}
  controller.pixelsPerBeat = 64
  controller.commit(state.removeRegion(controller.music, "track", "one"))
  assert.equal(controller.noteHistories.has("one"), false)
})

test("editor montado recebe compasso e resize sem perder nota nem remontar", () => {
  const controller = editingController()
  const title = { textContent: "" }
  const mount = { node: null, replaceChildren(node) { this.node = node || null } }
  const template = { content: { firstElementChild: { cloneNode() { return { dataset: {} } } } } }
  controller.regionEditorTarget = { hidden: true, querySelector(selector) {
    if (selector === "template") return template
    if (selector === "[data-region-editor-mount]") return mount
    if (selector === "[data-region-editor-title]") return title
    return null
  } }
  controller.hasRegionEditorTarget = true
  const contexts = []
  const editor = { totalTicks: 1920, numerator: () => 4, denominator: () => 4, bpm: () => 120,
    setMusicalContext(value) { contexts.push(value) }, stop() {} }
  controller.activePianoRoll = () => editor
  controller.syncActiveEditor()
  const mounted = mount.node
  assert.equal(mounted.dataset.pianoRollTotalTicksValue, "1920")
  assert.equal(mounted.dataset.pianoRollInstrumentIdValue, "piano")
  assert.equal(mounted.dataset.pianoRollBpmValue, "120")
  controller.music = state.resizeRegion(controller.music, "track", "one", 3840)
  controller.music.time_signature.numerator = 3
  controller.music.bpm = 90
  controller.syncActiveEditor()
  assert.equal(mount.node, mounted)
  assert.equal(contexts[0].totalTicks, 3840)
  assert.equal(contexts[0].numerator, 3)
  assert.equal(contexts[0].bpm, 90)
  assert.equal(controller.music.tracks[0].regions[0].notes[0].onset_tick, 0)
})

// Ampliar é uma mudança de apresentação: o nó MIDI, notas e histórico não podem ser recriados.
test("ampliar e voltar preserva o piano roll montado e a edição pendente", () => {
  const controller = editingController()
  const classes = new Set()
  const attributes = new Map()
  const editor = { notes: [{ id: "note-one", pitch: 72 }], selectedNoteIds: new Set(["note-one"]) }
  const background = { inert: false }
  dom.body.children = [{ tagName: "HEADER", inert: false }, { tagName: "MAIN", inert: false }]
  dom.body.style.overflow = "auto"
  controller.regionEditorTarget = {
    hidden: false, classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    setAttribute: (name, value) => attributes.set(name, value), removeAttribute: (name) => attributes.delete(name),
    closest: (selector) => {
      assert.equal(selector, ".compositions-editor-shell")
      return { querySelectorAll: () => [background] }
    }
  }
  controller.hasRegionEditorTarget = true
  controller.expandEditorButtonTarget = { textContent: "Ampliar editor", setAttribute() {}, focus() {} }
  controller.activePianoRoll = () => editor
  controller.render = () => { throw new Error("ampliar não deve remontar o editor") }

  controller.toggleRegionEditor()
  assert.equal(classes.has("is-expanded"), true)
  assert.equal(attributes.get("aria-modal"), "true")
  assert.equal(background.inert, true)
  assert.equal(dom.body.style.overflow, "hidden")
  controller.toggleRegionEditor()
  assert.equal(classes.has("is-expanded"), false)
  assert.equal(background.inert, false)
  assert.equal(dom.body.style.overflow, "auto")
  assert.equal(editor.notes[0].pitch, 72)
  assert.equal(editor.selectedNoteIds.has("note-one"), true)
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 60)
})

// Esc fecha a vista ampliada antes de o teclado do Canvas limpar a seleção de notas.
test("Escape fecha o editor ampliado e conserva a seleção MIDI", () => {
  const controller = editingController()
  let prevented = 0
  let stopped = 0
  let closed = 0
  controller.regionEditorExpanded = true
  controller.closeRegionEditor = () => { closed += 1 }
  controller.closeExpandedOnEscape({ key: "Escape", preventDefault() { prevented += 1 }, stopPropagation() { stopped += 1 } })
  assert.equal(closed, 1)
  assert.equal(prevented, 1)
  assert.equal(stopped, 1)
})

test("Ctrl+Z e Ctrl+Shift+Z afetam a região, não campos de formulário", () => {
  const controller = editingController()
  const changed = [{ id: "note-one", pitch: 72, onset: 0, duration: 480, velocity: 100 }]
  controller.notesChanged({ detail: { notes: changed } })
  controller.notesCommitted({ detail: { notes: changed } })
  let prevented = 0
  const event = { key: "z", ctrlKey: true, shiftKey: false, altKey: false,
    target: { closest: () => null }, preventDefault() { prevented += 1 } }
  controller.handleEditorKeydown(event)
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 60)
  event.shiftKey = true
  controller.handleEditorKeydown(event)
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 72)
  assert.equal(prevented, 2)
  event.target.closest = () => ({})
  controller.handleEditorKeydown(event)
  assert.equal(prevented, 2)
})

// Metadados editados entram no mesmo JSON que contém as faixas.
test("metadados atualizam o documento sem perder as faixas", () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Antes", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [{ id: "faixa" }] }
  controller.nameTarget = { value: "Depois" }
  controller.bpmTarget = { value: "90" }
  controller.numeratorTarget = { value: "3" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.changeMetadata()
  assert.equal(controller.music.name, "Depois")
  assert.equal(controller.music.bpm, 90)
  assert.equal(controller.music.time_signature.numerator, 3)
  assert.equal(controller.music.tracks[0].id, "faixa")
})

// Um conflito não substitui o trabalho local nem avança a versão de salvamento.
test("conflito ao salvar preserva o documento local", async () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Local", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [] }
  controller.lockVersion = 2
  controller.urlValue = "/compositions/id.json"
  controller.formTarget = { reportValidity: () => true }
  controller.nameTarget = { value: "Local" }
  controller.bpmTarget = { value: "120" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.saveButtonTarget = { disabled: false }
  controller.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: "Conflito" }) })
  let prevented = false
  await controller.save({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(controller.music.name, "Local")
  assert.equal(controller.lockVersion, 2)
  assert.match(controller.statusTarget.textContent, /Conflito/)
})

test("conflito 409 mantém notas pendentes e histórico da região ativa", async () => {
  const controller = editingController()
  const changed = [{ id: "note-one", pitch: 72, onset: 0, duration: 480, velocity: 110 }]
  controller.notesChanged({ detail: { notes: changed } })
  controller.notesCommitted({ detail: { notes: changed } })
  controller.lockVersion = 2
  controller.urlValue = "/compositions/id.json"
  controller.formTarget = { reportValidity: () => true }
  controller.nameTarget = { value: "Teste" }
  controller.bpmTarget = { value: "120" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  controller.saveButtonTarget = { disabled: false }
  controller.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: "Conflito" }) })
  await controller.save({ preventDefault() {} })
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 72)
  assert.equal(controller.noteHistories.get("one").snapshots.length, 2)
  assert.equal(controller.selectedRegionId, "one")
  assert.equal(controller.lockVersion, 2)
})

// Uma resposta tardia confirma a versão, mas não apaga edições feitas durante o envio.
test("salvamento tardio preserva edicoes posteriores", async () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Primeira", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [] }
  controller.lockVersion = 0
  controller.urlValue = "/compositions/id.json"
  const versionField = { value: 0 }
  controller.formTarget = { reportValidity: () => true, querySelector: () => versionField }
  controller.nameTarget = { value: "Primeira" }
  controller.bpmTarget = { value: "120" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.saveButtonTarget = { disabled: false }
  let resolveRequest
  controller.fetch = () => new Promise((resolve) => { resolveRequest = resolve })
  const saving = controller.save({ preventDefault() {} })
  controller.music.name = "Segunda"
  controller.revision = 1
  resolveRequest({ ok: true, json: async () => ({ document: { name: "Primeira" }, lock_version: 1 }) })
  await saving
  assert.equal(controller.music.name, "Segunda")
  assert.equal(controller.lockVersion, 1)
  assert.match(controller.statusTarget.textContent, /ainda não salvas/)
})

// Conflito após uma edição concorrente não deve criar um ciclo infinito de autosave.
test("conflito tardio não reagenda autosave automaticamente", async () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Primeira", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [] }
  controller.lockVersion = 0
  controller.urlValue = "/compositions/id.json"
  const versionField = { value: 0 }
  controller.formTarget = { reportValidity: () => true, querySelector: () => versionField }
  controller.nameTarget = { value: "Primeira" }
  controller.bpmTarget = { value: "120" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.saveButtonTarget = { disabled: false }
  let resolveRequest
  controller.fetch = () => new Promise((resolve) => { resolveRequest = resolve })
  let scheduled = 0
  controller.scheduleAutosave = () => { scheduled += 1 }
  const saving = controller.save({ preventDefault() {} })
  controller.music.name = "Segunda"
  controller.revision = 1
  resolveRequest({ ok: false, status: 409, json: async () => ({ error: "Conflito" }) })
  await saving
  assert.equal(scheduled, 0)
  assert.equal(controller.music.name, "Segunda")
})

// Mudanças locais devem chegar ao áudio sem reiniciar a agulha nem exigir Save.
test("edições de notas e metadados atualizam transporte sem pará-lo", () => {
  const controller = editingController()
  const transport = transportSpy()
  controller.transport = transport
  controller.commit(state.updateTrack(controller.music, "track", { volume: 0.5 }))
  const changed = [{ id: "note-one", pitch: 72, onset: 0, duration: 480, velocity: 100 }]
  controller.notesChanged({ detail: { notes: changed } })
  controller.notesCommitted({ detail: { notes: changed } })
  controller.undoNotes()
  controller.nameTarget = { value: "Novo nome" }
  controller.bpmTarget = { value: "90" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  const priorMusic = controller.music
  controller.changeMetadata()
  assert.notEqual(controller.music, priorMusic)
  assert.equal(priorMusic.bpm, 120)
  assert.equal(transport.calls.filter((call) => call[0] === "update").length, 4)
  assert.equal(transport.calls.some((call) => call[0] === "stop"), false)
  assert.equal(transport.calls.at(-1)[1].bpm, 90)
})

// O usuário ouve o documento atual, mesmo se ainda houver mudanças pendentes.
test("play da composição interrompe só a prévia individual", async () => {
  const controller = editingController()
  const transport = transportSpy()
  controller.transport = transport
  let previewStops = 0
  controller.activePianoRoll = () => ({ stop() { previewStops += 1 } })
  controller.music.tracks[0].regions[0].notes[0].pitch = 75
  await controller.playComposition()
  assert.equal(previewStops, 1)
  assert.equal(transport.calls.at(-1)[0], "play")
  assert.equal(transport.calls.at(-1)[1].tracks[0].regions[0].notes[0].pitch, 75)
  controller.pauseComposition()
  controller.stopComposition()
  assert.deepEqual(transport.calls.slice(-2).map((call) => call[0]), ["pause", "stop"])
})

test("controle compacto alterna entre tocar/retomar e parar", async () => {
  const controller = editingController()
  controller.transport = transportSpy()
  controller.activePianoRoll = () => null
  controller.playbackStatus = "stopped"
  await controller.toggleCompositionPlayback()
  assert.deepEqual(controller.transport.calls.map((call) => call[0]), ["isolate", "play"])
  controller.playbackStatus = "playing"
  await controller.toggleCompositionPlayback()
  assert.equal(controller.transport.calls.at(-1)[0], "stop")
  controller.playbackStatus = "paused"
  await controller.toggleCompositionPlayback()
  assert.equal(controller.transport.calls.at(-1)[0], "resume")
})

// Os campos de marcador usam os mesmos ticks persistidos, sem afetar outras faixas.
test("marcadores numéricos entram no documento e deixam o salvamento pendente", () => {
  const controller = editingController()
  const transport = transportSpy()
  controller.transport = transport
  controller.loopStartTarget = { value: "480" }
  controller.loopEndTarget = { value: "2400" }
  controller.changeLoopMarker()
  assert.equal(controller.music.loop.start_tick, 480)
  assert.equal(controller.music.loop.end_tick, 2400)
  assert.match(controller.statusTarget.textContent, /não salvas/)
  assert.equal(transport.calls.at(-1)[0], "update")
})

// Posição visual não pode provocar remount ou perda de foco no editor aberto.
test("pulso da agulha só altera apresentação e desconexão libera áudio", () => {
  const controller = editingController()
  const transport = transportSpy()
  controller.transport = transport
  controller.pixelsPerBeat = 64
  controller.playheadTarget = { style: {} }
  controller.transportStatusTarget = { textContent: "" }
  controller.render = () => { throw new Error("não reconstruir timeline por pulso") }
  controller.onTransportState({ status: "playing", tick: 480, loopEnabled: true, unavailableTrackIds: [] })
  assert.equal(controller.playheadTarget.style.left, "64px")
  assert.match(controller.transportStatusTarget.textContent, /Reproduzindo/)
  controller.activePianoRoll = () => null
  controller.disconnect()
  assert.equal(transport.calls.at(-1)[0], "dispose")
})

// A prévia de uma região não deve tocar sobre o transporte global.
test("iniciar prévia individual pausa composição, sem descartar o documento", () => {
  const controller = editingController()
  controller.transport = transportSpy()
  controller.previewStarted()
  assert.deepEqual(controller.transport.calls.map((call) => call[0]), ["pause"])
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 60)
})

// Isolamento e modo de loop são controles da escuta, não mutações do JSON.
test("ouvir faixa e alternar loop preservam documento e seleção", async () => {
  const controller = editingController()
  controller.transport = transportSpy()
  controller.activePianoRoll = () => null
  controller.loopEnabled = true
  const before = JSON.stringify(controller.music)
  await controller.playTrack("track")
  controller.toggleCompositionLoop()
  assert.deepEqual(controller.transport.calls.map((call) => call[0]), ["isolate", "play", "loop"])
  assert.equal(controller.transport.calls.at(-1)[1], false)
  assert.equal(JSON.stringify(controller.music), before)
  assert.equal(controller.selectedRegionId, "one")
})

// Play global após uma escuta isolada deve devolver todas as faixas audíveis.
test("play global remove isolamento sem reiniciar agulha em movimento", async () => {
  const controller = editingController()
  controller.transport = transportSpy()
  controller.activePianoRoll = () => null
  controller.playbackStatus = "playing"
  await controller.playComposition()
  assert.deepEqual(controller.transport.calls.map((call) => call[0]), ["isolate"])
  assert.equal(controller.transport.calls[0][1], null)
})

// As setas permitem editar os marcadores sem ponteiro e mantêm o snap musical.
test("seta em marcador avança uma batida e rejeita cruzamento", () => {
  const controller = editingController()
  controller.transport = transportSpy()
  const handle = { dataset: { marker: "start" }, focus() {} }
  let prevented = false
  controller.loopMarkerKey({ key: "ArrowRight", currentTarget: handle, preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(controller.music.loop.start_tick, 480)
  assert.equal(controller.music.loop.end_tick, 3840)
  const revision = controller.revision
  controller.applyLoopMarker("start", 3840)
  assert.equal(controller.revision, revision)
  assert.match(controller.statusTarget.textContent, /Marcadores não aplicados/)
})
