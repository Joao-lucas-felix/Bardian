import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import * as state from "../../app/javascript/composition/timeline_state.js"
import * as notes from "../../app/javascript/composition/region_notes.js"
import * as history from "../../app/javascript/composition/note_history.js"

// Carrega o controller com Stimulus mínimo para verificar o protocolo de salvamento.
const source = readFileSync(new URL("../../app/javascript/controllers/composition_timeline_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class TimelineController extends Controller")
  .concat("\nTimelineController")
const Controller = vm.runInNewContext(source, {
  Controller: class {}, ...state, ...notes, ...history, crypto: { randomUUID: () => "uuid" },
  document: { querySelector: () => ({ content: "token" }) },
  window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }
})

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
