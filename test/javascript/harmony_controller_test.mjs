import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import { appendChords, removeLastChord, moveChord, removeChord, resizeChord, roleTrack, harmonyEnd, applyRecovery } from "../../app/javascript/composition/harmony_draft.js"
import { editorState, applyEditorNotes } from "./helpers/harmony_editor.mjs"
import { newNoteId } from "../../app/javascript/composition/region_notes.js"
import { createHistory, record, undo, redo } from "../../app/javascript/composition/harmony_history.js"

// Só Web Audio e DOM são externos; o documento e suas edições usam o código real.
const source = readFileSync(new URL("../../app/javascript/controllers/harmony_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class HarmonyController extends Controller")
  .concat("\nHarmonyController")
const actions = []
let failAudio = false
const audio = {
  loadTrack: async (track) => { actions.push(["load", track.instrument_id]); if (failAudio) throw new Error("sem sample") },
  start: async () => { actions.push(["start"]) },
  now: () => 0,
  trigger: (id, pitch, duration, time) => { actions.push(["note", id, pitch, time]); return true },
  dispose: () => { actions.push(["dispose-audio"]) }
}
const transport = {
  setLoopEnabled: (value) => actions.push(["loop", value]),
  stop: () => actions.push(["stop"]),
  update: () => actions.push(["update"]),
  warm: async (music) => { actions.push(["warm", music.tracks[0].instrument_id]) },
  play: async (music) => { actions.push(["play", music.tracks[0].regions[0].notes.length]) },
  dispose: () => actions.push(["dispose-transport"])
}
let serial = 0
const browserWindow = { addEventListener() {}, removeEventListener() {} }
// DOM mínimo: verifica os controles gerados sem depender de um navegador no teste unitário.
class Element {
  constructor(tagName = "div") { this.tagName = tagName; this.children = []; this.dataset = {}; this.style = {}; this.textContent = "" }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this.children = children }
  setAttribute(name, value) { this[name] = value }
  contains(element) { return this.children.includes(element) || this.children.some((child) => child.contains?.(element)) }
  focus() { browserDocument.activeElement = this }
}
const catalogue = { piano: { label: "Piano" }, strings: { label: "Cordas" }, drums: { label: "Bateria" } }
const browserDocument = { querySelector: () => ({ content: "csrf" }), createElement: (name) => new Element(name), activeElement: null }
const Controller = vm.runInNewContext(source, {
  Controller: class {}, appendChords, removeLastChord, moveChord, removeChord, resizeChord, roleTrack, harmonyEnd, applyRecovery,
  editorState, applyEditorNotes, newNoteId, createHistory, record, undo, redo,
  INSTRUMENT_CATALOG: catalogue,
  createCompositionAudio: () => audio, createCompositionTransport: () => transport,
  createHarmonyPlayback: () => transport,
  crypto: { randomUUID: () => `generated-${++serial}` },
  document: browserDocument, window: browserWindow,
  structuredClone, console
})

/** Monta um estado recebido do domínio e um documento MIDI compatível. */
function setup() {
  actions.length = 0
  failAudio = false
  const music = { version: 1, id: "draft", name: "Harmonia guiada", bpm: 120,
    time_signature: { numerator: 4, denominator: 4 }, context: { tonic: "C", mode: "major" },
    tracks: [{ id: "harmony", name: "Harmonia", instrument_id: "piano", volume: 1,
      mute: false, solo: false, regions: [{ id: "region", start_tick: 0, duration_ticks: 480, notes: [] }] }] }
  const option = { index: 0, degree: "I", symbol: "C", function: "tonic", notes: ["C", "E", "G"], explanation: "Pode trazer uma sensação de descanso.", pitches: [60, 64, 67] }
  const state = { options: [option], slots: [], next_onset_tick: 0, can_append: true,
    can_generate: true, can_continue: false, continue_reason: null }
  const controller = new Controller()
  controller.documentValue = music
  controller.stateValue = state
  controller.assistUrlValue = "/harmonia/assist"
  controller.statusTarget = { textContent: "" }
  controller.render = () => {}
  controller.connect()
  controller.request = async () => ({ ok: true, json: async () => ({ state: { ...state, next_onset_tick: 480 }, preview: null }) })
  return { controller, music, state, option }
}

/** Configura controles persistidos sem depender de Stimulus ou de rede real. */
function savedSetup() {
  const { controller } = setup()
  controller.hasSaveUrlValue = true
  controller.saveUrlValue = "/compositions/example/harmony"
  controller.lockVersionValue = 3
  controller.saveButtonTarget = { disabled: false }
  controller.saveStatusTarget = { textContent: "" }
  controller.dirty = true
  controller.editRevision = 1
  return controller
}

/** A animação visual acompanha o transporte, sem representar volume ou alterar notas. */
test("indicador SVG acompanha reprodução e fica imóvel nos demais estados", () => {
  const { controller } = setup()
  controller.hasPlaybackMeterTarget = true
  controller.playbackMeterTarget = { dataset: {} }
  controller.renderCursor = () => {}
  for (const status of ["playing", "paused", "loading", "stopped", "error"]) {
    controller.transportState({ status })
    assert.equal(controller.playbackMeterTarget.dataset.state, status)
  }
})

test("piano roll inicial hidrata o painel sem precisar trocar de aba", () => {
  const { controller } = setup()
  let hydrated = false
  controller.hasPanelTarget = true
  controller.panelTarget = { dataset: { panel: "editor" } }
  controller.panelLoaded = () => { hydrated = true }
  controller.connect()
  assert.equal(hydrated, true)
})

// A projeção reduz a largura visual da composição salva, mas preserva seus ticks.
test("timeline salva usa uma escala compacta sem mudar a unidade musical", () => {
  const { controller: draft } = setup()
  const saved = savedSetup()
  assert.equal(draft.beatPixels(), 136)
  assert.equal(saved.beatPixels(), 108)
})

test("notas livres confirmadas mantem historico e estado nao salvo", async () => {
  const controller = savedSetup()
  controller.dirty = false
  controller.history = createHistory(controller.music)
  assert.equal(typeof controller.notesChanged, "function")
  controller.notesChanged({ detail: { notes: [{ id: "free", pitch: 61, onset: 17, duration: 200, velocity: 90 }] } })
  await controller.notesCommitted({ detail: { notes: [{ id: "free", pitch: 61, onset: 17, duration: 200, velocity: 90 }] } })
  assert.equal(controller.music.tracks[0].regions[0].notes[0].onset_tick, 17)
  assert.equal(controller.dirty, true)
  await controller.undoNotes()
  assert.equal(controller.music.tracks[0].regions[0].notes.length, 0)
  await controller.redoNotes()
  assert.equal(controller.music.tracks[0].regions[0].notes[0].pitch, 61)
})

test("troca de timbre salvo marca dirty sem alterar notas", async () => {
  const controller = savedSetup()
  controller.dirty = false
  controller.music.tracks[0].id = "harmony-draft"
  const extra = structuredClone(controller.music.tracks[0])
  extra.id = "harmony-extra-draft"
  extra.name = "Notas adicionais"
  controller.music.tracks.push(extra)
  controller.instrumentTarget = { value: "harmony_pad" }
  controller.catalogueValue = [{ id: "harmony_pad", label: "Pad" }]
  const before = structuredClone(controller.music.tracks[0].regions[0])
  await controller.changeInstrument()
  assert.equal(controller.dirty, true)
  assert.equal(controller.music.tracks[0].instrument_id, "harmony_pad")
  assert.equal(controller.music.tracks[1].instrument_id, "harmony_pad")
  assert.deepEqual(controller.music.tracks.map(({ volume, mute, solo }) => ({ volume, mute, solo })), [
    { volume: 1, mute: false, solo: false }, { volume: 1, mute: false, solo: false }
  ])
  assert.deepEqual(controller.music.tracks[0].regions[0], before)
})

test("troca de timbre prepara escolha atual sem iniciar reprodução", async () => {
  const controller = savedSetup()
  controller.music.tracks[0].regions[0].notes.push({ id: 'note', pitch: 60, onset_tick: 0, duration_ticks: 480, velocity: 90 })
  controller.instrumentTarget = { value: 'strings' }
  controller.catalogueValue = [{ id: 'strings', label: 'Cordas' }]
  await controller.changeInstrument()
  assert.deepEqual(actions.filter(([type]) => type === 'warm'), [['warm', 'strings']])
  assert.equal(actions.some(([type]) => type === 'play'), false)
})

test("painel obsoleto e falha de frame preservam o rascunho local", () => {
  const controller = savedSetup()
  const before = structuredClone(controller.music)
  controller.selectPanel({ currentTarget: { dataset: { panel: "editor" } } })
  let blocked = false
  controller.beforePanelRender({ detail: { newFrame: { dataset: { panel: "settings" } } }, preventDefault() { blocked = true } })
  assert.equal(blocked, true)
  controller.panelFailed({ preventDefault() {} })
  assert.deepEqual(controller.music, before)
  assert.equal(controller.dirty, true)
  assert.match(controller.statusTarget.textContent, /alterações continuam/)
})

test("alternar painel preserva acorde selecionado e posição de reprodução", () => {
  const { controller } = setup()
  controller.selectedIndex = 0
  controller.positionTick = 840

  controller.selectPanel({ currentTarget: { dataset: { panel: "settings" } } })
  controller.panelLoaded()

  assert.equal(controller.selectedIndex, 0)
  assert.equal(controller.positionTick, 840)
  assert.deepEqual(controller.music, controller.documentValue)
})

test("painel substituído atualiza a área e o destino ativo do menu", () => {
  const { controller } = setup()
  // Simula os dois sinais visuais do link inicial para detectar destaque duplicado.
  const links = ["guided", "settings", "editor"].map((panel) => {
    const classes = new Set(panel === "guided" ? ["is-current"] : [])
    const attributes = new Map(panel === "guided" ? [["aria-current", "page"]] : [])
    return { dataset: { panel }, classes, attributes,
      classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name) }
  })
  controller.render = () => {}
  controller.expectedPanel = "settings"
  controller.hasPanelTarget = true
  controller.panelTarget = { dataset: { panel: "guided" }, querySelector: () => null }
  controller.hasEditorMountTarget = false
  controller.element = { querySelectorAll: () => links }

  controller.panelLoaded()

  assert.equal(controller.panelTarget.dataset.panel, "settings")
  assert.deepEqual(links.filter((link) => link.classes.has("is-current")).map((link) => link.dataset.panel), ["settings"])
  assert.deepEqual(links.filter((link) => link.attributes.has("aria-current")).map((link) => link.dataset.panel), ["settings"])
})

test("abrir painel auxiliar leva a área recém-carregada à janela", () => {
  const { controller } = setup()
  let options
  controller.hasPanelTarget = true
  controller.panelTarget = { scrollIntoView: (value) => { options = value } }

  controller.selectPanel({ currentTarget: { dataset: { panel: "settings" } } })

  assert.equal(options.block, "start")
  assert.equal(options.behavior, "smooth")
})

test("painel carregado alinha seu primeiro título à área visível", () => {
  const { controller } = setup()
  let options
  controller.expectedPanel = "settings"
  controller.panelTarget = { querySelector: () => ({ scrollIntoView: (value) => { options = value } }) }
  controller.hasPanelTarget = true

  controller.panelLoaded()

  assert.equal(options.block, "start")
  assert.equal(options.behavior, "smooth")
})

test("proposta de recuperação aparece resumida sem montar o formulário auxiliar", () => {
  const { controller } = setup()
  controller.state.recovery = { status: "candidate", blocks: [{ id: "one" }, { id: "two" }] }
  controller.hasRecoverySummaryTarget = true
  controller.recoverySummaryTarget = { hidden: true, textContent: "" }
  controller.hasRecoverySummaryTextTarget = true
  controller.recoverySummaryTextTarget = { textContent: "" }
  controller.hasRecoveryTarget = false

  controller.renderRecovery()

  assert.equal(controller.recoverySummaryTarget.hidden, false)
  assert.match(controller.recoverySummaryTextTarget.textContent, /2 acordes/)
})

test("descartar ajustes da proposta restaura a fonte original", () => {
  const { controller } = setup()
  controller.recoverySource = "proposta-original"
  controller.manualBlocks = [{ chord: { root: "D", quality: "major" } }]
  controller.recoveryAssignments = { note: "realization" }

  controller.cancelRecovery()

  assert.equal(controller.recoverySource, null)
  assert.equal(controller.manualBlocks, undefined)
  assert.equal(controller.recoveryAssignments, undefined)
})

test("gesto invalido nao entra no historico nem substitui notas", async () => {
  const controller = savedSetup()
  const before = structuredClone(controller.music)
  const notes = [{ id: "bad", pitch: 128, onset: 0, duration: 480, velocity: 90 }]
  controller.notesChanged({ detail: { notes } })
  await controller.notesCommitted({ detail: { notes } })
  assert.deepEqual(controller.music, before)
  assert.equal(controller.history.snapshots.length, 1)
})

test("salva documento e versao sem enviar apenas a ultima alteracao", async () => {
  const controller = savedSetup()
  let sent
  controller.request = async (url, options) => {
    sent = JSON.parse(options.body)
    assert.equal(url, controller.saveUrlValue)
    assert.equal(options.method, "PATCH")
    return { ok: true, json: async () => ({ lock_version: 4 }) }
  }
  await controller.save()
  assert.equal(sent.lock_version, 3)
  assert.deepEqual(sent.document, controller.music)
  assert.equal(controller.lockVersionValue, 4)
  assert.equal(controller.dirty, false)
  assert.equal(controller.saveStatusTarget.textContent, "Salvo")
})

test("conflito mantem edicao e permite nova tentativa sem sobrescrever", async () => {
  const controller = savedSetup()
  const original = structuredClone(controller.music)
  controller.request = async () => ({ ok: false, json: async () => ({ error: "Mudou em outra aba" }) })
  await controller.save()
  assert.deepEqual(controller.music, original)
  assert.equal(controller.lockVersionValue, 3)
  assert.equal(controller.dirty, true)
  assert.equal(controller.saveButtonTarget.disabled, false)
  assert.match(controller.saveStatusTarget.textContent, /outra aba/)
})

test("edicao durante envio continua marcada como nao salva", async () => {
  const controller = savedSetup()
  let resolve
  controller.request = () => new Promise((done) => { resolve = done })
  const saving = controller.save()
  controller.editRevision += 1
  resolve({ ok: true, json: async () => ({ lock_version: 4 }) })
  await saving
  assert.equal(controller.dirty, true)
  assert.equal(controller.lockVersionValue, 4)
  assert.equal(controller.saveButtonTarget.disabled, false)
})

test("reordenar por controle interrompe audio e marca nova ordem para salvar", async () => {
  const controller = savedSetup()
  let id = 0
  controller.music = appendChords(controller.music, [
    { pitches: [60, 64, 67], onset_tick: 0 }, { pitches: [67, 71, 74], onset_tick: 480 }
  ], () => `reorder-${++id}`)
  controller.laneTarget = { querySelector: () => null }
  controller.state.slots = [{ onset_tick: 0, duration_ticks: 480 }, { onset_tick: 480, duration_ticks: 480 }]
  const original = controller.music.tracks[0].regions[0].notes.map(n => n.id)
  await controller.reorder(0, 1)
  assert.deepEqual(controller.music.tracks[0].regions[0].notes.map(n => n.id), [...original.slice(3), ...original.slice(0, 3)])
  assert.equal(controller.selectedSlot, 1)
  assert.equal(controller.dirty, true)
  assert.ok(actions.some(a => a[0] === "update"))
  assert.match(controller.statusTarget.textContent, /tempo 2/)
})

test("mantem o resumo da sequencia quando a edicao saiu do modo guiado", () => {
  const { controller } = setup()
  controller.music.tracks[0].regions[0].duration_ticks = 960
  controller.music.tracks[0].regions[0].notes = [
    { id: "free-1", pitch: 60, onset_tick: 0, duration_ticks: 480, velocity: 90 },
    { id: "free-2", pitch: 63, onset_tick: 480, duration_ticks: 480, velocity: 90 }
  ]
  controller.state = { guided: false, slots: [], editing_reason: "Edição livre: use Editar composição." }
  controller.laneTarget = new Element()

  controller.renderLane()

  assert.equal(controller.laneTarget.children.length, 1)
  assert.equal(controller.laneTarget.children[0].className, "harmony-lane-free")
  assert.match(controller.laneTarget.children[0].children[0].textContent, /Sequência editada/)
  assert.match(controller.laneTarget.children[0].children[1].textContent, /2 notas · 2 tempos/)
})

test("selecionar acorde toca no instrumento da faixa sem criar notas", async () => {
  const { controller, music } = setup()
  await controller.selectChord({ currentTarget: { dataset: { index: "0" } } })

  assert.deepEqual(controller.music, music)
  assert.deepEqual(actions.filter((entry) => entry[0] === "note").map((entry) => entry[2]), [60, 64, 67])
  assert.ok(actions.filter((entry) => entry[0] === "note").every((entry) => entry[3] === undefined))
  assert.ok(actions.some((entry) => entry[0] === "load" && entry[1] === "piano"))
})

test("adicionar e aplicar previa exigem comandos explicitos", async () => {
  const { controller, option } = setup()
  await controller.selectChord({ currentTarget: { dataset: { index: "0" } } })
  assert.equal(controller.music.tracks[0].regions[0].notes.length, 0)
  await controller.applySelected()
  assert.equal(controller.music.tracks[0].regions[0].notes.length, 3)

  const preview = [480, 960, 1440, 1920].map((onset_tick) => ({ ...option, onset_tick }))
  controller.request = async () => ({ ok: true, json: async () => ({ state: controller.state, preview }) })
  await controller.generate()
  assert.equal(controller.music.tracks[0].regions[0].notes.length, 3)
  await controller.applyPreview()
  assert.equal(controller.music.tracks[0].regions[0].notes.length, 15)
  assert.equal(controller.preview, null)
})

test("mudar tonalidade conserva midi e invalida previa", async () => {
  const { controller, option } = setup()
  await controller.selectChord({ currentTarget: { dataset: { index: "0" } } })
  await controller.applySelected()
  controller.preview = [{ ...option, onset_tick: 480 }]
  controller.tonicTarget = { value: "D" }
  controller.modeTarget = { value: "major" }
  await controller.changeContext()

  assert.equal(controller.music.context.tonic, "D")
  assert.deepEqual(controller.music.tracks[0].regions[0].notes.map((note) => note.pitch), [60, 64, 67])
  assert.equal(controller.preview, null)
})

test("desfazer sincroniza BPM, tonalidade e modo com os valores restaurados", async () => {
  const { controller } = setup()
  controller.hasBpmTarget = true
  controller.hasTonicTarget = true
  controller.hasModeTarget = true
  controller.bpmTarget = { value: "130" }
  controller.tonicTarget = { value: "D" }
  controller.modeTarget = { value: "natural_minor" }
  controller.history = createHistory(controller.music)
  await controller.changeContext()
  await controller.undoNotes()

  assert.equal(controller.music.context.tonic, "C")
  assert.equal(controller.music.context.mode, "major")
  assert.equal(controller.tonicTarget.value, "C")
  assert.equal(controller.modeTarget.value, "major")
  assert.equal(controller.bpmTarget.value, 120)
})

test("alterar BPM substitui análise pendente invalidada pela edição", async () => {
  const { controller, state } = setup()
  const pending = []
  controller.request = () => new Promise((resolve) => pending.push(resolve))
  const oldAnalysis = controller.requestState("analyze")
  controller.bpmTarget = { value: "130" }
  const bpmChange = controller.changeBpm()

  assert.equal(controller.music.bpm, 130)
  assert.equal(pending.length, 2)
  pending[1]({ ok: true, json: async () => ({ state: { ...state, next_onset_tick: 960 }, preview: null }) })
  await bpmChange
  pending[0]({ ok: true, json: async () => ({ state, preview: null }) })
  await oldAnalysis
  assert.equal(controller.state.next_onset_tick, 960)
})

test("resposta atrasada nao restaura uma previa antiga", async () => {
  const { controller, state } = setup()
  const pending = []
  controller.request = () => new Promise((resolve) => pending.push(resolve))
  const first = controller.requestState("generate")
  const second = controller.requestState("analyze")
  pending[1]({ ok: true, json: async () => ({ state: { ...state, next_onset_tick: 480 }, preview: null }) })
  await second
  pending[0]({ ok: true, json: async () => ({ state, preview: [{ onset_tick: 0 }] }) })
  await first
  assert.equal(controller.state.next_onset_tick, 480)
  assert.equal(controller.preview, null)
})

test("troca de contexto cancela a escuta de um sample ainda carregando", async () => {
  const { controller } = setup()
  let finishLoad
  const originalLoad = audio.loadTrack
  audio.loadTrack = () => new Promise((resolve) => { finishLoad = resolve })
  const audition = controller.selectChord({ currentTarget: { dataset: { index: "0" } } })
  controller.tonicTarget = { value: "D" }
  controller.modeTarget = { value: "major" }
  await controller.changeContext()
  finishLoad()
  await audition
  audio.loadTrack = originalLoad

  assert.equal(actions.filter((entry) => entry[0] === "note").length, 0)
})

test("troca de contexto bloqueia aplicacao do campo antigo enquanto reanalisa", async () => {
  const { controller } = setup()
  controller.selectedIndex = 0
  controller.tonicTarget = { value: "D" }
  controller.modeTarget = { value: "major" }
  controller.request = () => new Promise(() => {})
  controller.changeContext()
  void controller.applySelected()

  assert.equal(controller.music.tracks[0].regions[0].notes.length, 0)
})

test("erro de audio nao altera notas e desmontagem libera transporte", async () => {
  const { controller, music } = setup()
  failAudio = true
  await controller.selectChord({ currentTarget: { dataset: { index: "0" } } })
  assert.deepEqual(controller.music, music)
  assert.match(controller.statusTarget.textContent, /áudio|sample/i)
  controller.disconnect()
  assert.ok(actions.some((entry) => entry[0] === "dispose-transport"))
})

test("reconexao restaura transporte sem descartar rascunho, dirty ou historico", () => {
  const { controller } = setup()
  controller.music = appendChords(controller.music, [{ pitches: [60, 64, 67], onset_tick: 0 }], () => `reconnect-${++serial}`)
  controller.history = record(controller.history, controller.music)
  controller.dirty = true
  controller.editRevision = 7
  const draft = structuredClone(controller.music)
  const history = controller.history

  controller.disconnect()
  controller.connect()

  assert.deepEqual(controller.music, draft)
  assert.equal(controller.history, history)
  assert.equal(controller.dirty, true)
  assert.equal(controller.editRevision, 7)
  assert.equal(controller.positionTick, 0)
})

test("resposta de salvamento da sessao antiga nao muda o estado reconectado", async () => {
  const controller = savedSetup()
  let resolve
  controller.request = () => new Promise((done) => { resolve = done })
  const saving = controller.save()
  controller.disconnect()
  controller.connect()
  controller.saveStatusTarget.textContent = "Rascunho preservado"
  resolve({ ok: true, json: async () => ({ lock_version: 99 }) })
  await saving

  assert.equal(controller.lockVersionValue, 3)
  assert.equal(controller.dirty, true)
  assert.equal(controller.saveStatusTarget.textContent, "Rascunho preservado")
})

test("aviso de saida aparece apenas quando a faixa tem notas", async () => {
  const { controller } = setup()
  const blank = { prevented: false, preventDefault() { this.prevented = true }, returnValue: null }
  controller.warnBeforeUnload(blank)
  assert.equal(blank.prevented, false)

  controller.music = appendChords(controller.music, [{ pitches: [60, 64, 67], onset_tick: 0 }], () => `n-${++serial}`)
  const filled = { prevented: false, preventDefault() { this.prevented = true }, returnValue: null }
  controller.warnBeforeUnload(filled)
  assert.equal(filled.prevented, true)
})

test("renderiza roda, tempos, previa e instrumentos sem oferecer bateria", () => {
  const { controller, state, option } = setup()
  controller.render = Controller.prototype.render
  controller.wheelTarget = new Element()
  controller.laneTarget = new Element()
  controller.previewTarget = new Element()
  controller.selectionTarget = new Element()
  controller.instrumentTarget = new Element("select")
  for (const name of ["addButton", "removeButton", "generateButton", "continueButton", "applyPreviewButton", "playButton", "playPreviewButton"]) controller[`${name}Target`] = new Element("button")
  controller.state = { ...state, slots: [{ onset_tick: 0, degree: "I", symbol: "C", function: "tonic", tension: "repouso", explanation: "Pode trazer uma sensação de descanso." }], next_onset_tick: 480, can_continue: true }
  controller.selectedIndex = 0
  controller.preview = [{ ...option, onset_tick: 480 }]
  controller.populateInstruments()
  controller.render()

  assert.deepEqual(controller.instrumentTarget.children.map((item) => item.value), ["piano", "strings"])
  assert.equal(controller.wheelTarget.children.filter((item) => item.tagName === "button").length, 1)
  assert.match(controller.wheelTarget.children[0]["aria-label"], /^Ouvir C\./)
  assert.doesNotMatch(controller.wheelTarget.children[0]["aria-label"], /grau|tônica|predominante/)
  assert.equal(controller.laneTarget.children.length, 2)
  assert.equal(controller.laneTarget.children[0].children[1].children.length, 1)
  assert.equal(controller.laneTarget.children[0].children[1].children[0].children[1].textContent, "I · C")
  assert.equal(controller.previewTarget.children.length, 1)
  assert.equal(controller.addButtonTarget.disabled, false)
  assert.equal(controller.continueButtonTarget.disabled, false)
  assert.equal(controller.applyPreviewButtonTarget.disabled, false)
  assert.match(controller.selectionTarget.textContent, /Notas: C, E, G\. Pode trazer uma sensação de descanso\./)
  controller.state.slots[0] = { onset_tick: 0, degree: null, symbol: null, function: null, tension: "fora do campo", explanation: "Este acorde usa notas de fora do tom escolhido." }
  controller.render()
  assert.equal(controller.laneTarget.children[0].children[1].children[0].children[1].textContent, "Fora do campo")
})

test("roda mantem foco do acorde apos selecionar por teclado", () => {
  const { controller } = setup()
  controller.render = Controller.prototype.render
  controller.wheelTarget = new Element()
  controller.laneTarget = new Element()
  controller.previewTarget = new Element()
  controller.selectionTarget = new Element()
  for (const name of ["addButton", "removeButton", "generateButton", "continueButton", "applyPreviewButton", "playButton", "playPreviewButton"]) controller[`${name}Target`] = new Element("button")
  controller.render()
  const oldButton = controller.wheelTarget.children[0]
  oldButton.focus()
  controller.selectedIndex = 0
  controller.render()

  assert.notEqual(controller.wheelTarget.children[0], oldButton)
  assert.equal(browserDocument.activeElement, controller.wheelTarget.children[0])
})

test("historico declarado restaura bloco e notas juntos", async () => {
  const { controller } = setup()
  controller.music.tracks[0].id = "harmony-draft"
  controller.music.harmony = { blocks: [] }
  controller.history = createHistory(controller.music)
  const before = structuredClone(controller.music)
  const next = structuredClone(before)
  next.harmony.blocks = [{ id: "block", onset_tick: 0, duration_ticks: 480, chord: { root: "C", quality: "major" } }]
  controller.commit(next)
  await controller.undoNotes()
  assert.deepEqual(controller.music, before)
})
