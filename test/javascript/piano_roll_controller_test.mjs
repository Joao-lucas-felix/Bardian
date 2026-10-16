import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Executa a classe real sem inicializar Stimulus, Tone.js ou o DOM do Rails.
const controllerPath = new URL("../../app/javascript/controllers/piano_roll_controller.js", import.meta.url)
const source = readFileSync(controllerPath, "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class PianoRollController extends Controller")
const Tone = {
  start: async () => {},
  now: () => 10
}
const instruments = []
let failInstrumentLoad = false
let deferInstrumentLoad = false
let resolveInstrumentLoad
const createPhraseInstrument = (id) => {
  const instrument = {
    id, events: [], disposed: false,
    async load() {
      if (failInstrumentLoad) throw new Error("amostra ausente")
      if (deferInstrumentLoad) await new Promise((resolve) => { resolveInstrumentLoad = resolve })
    },
    trigger(...event) { this.events.push(event) },
    dispose() { this.disposed = true }
  }
  instruments.push(instrument)
  return instrument
}
const dom = { createElement: (tagName) => ({ tagName: tagName.toUpperCase(), className: "", dataset: {}, attributes: {}, children: [], addEventListener() { this.listens = true }, setAttribute(name, value) { this.attributes[name] = value }, append(child) { this.children.push(child) } }) }
// Mantém o teste nos cálculos do controller; o pacote externo só recebe medidas.
class Rational { constructor(numerator, denominator = 1) { this.numerator = numerator; this.denominator = denominator } }
class Duration { constructor(options) { this.base = options.base } }
class ScoreBuilder {
  constructor() { this.measures = []; this.notes = [] }
  newPartId() { return "part-1" }
  newMeasureId() { return `measure-${this.measures.length + 1}` }
  setMetadata() {}
  addPart() {}
  addMeasure(measure) { this.measures.push(measure) }
  addNote(_part, note) { this.notes.push(note) }
  build() { return { measures: this.measures, notes: this.notes } }
}
const PianoRollController = vm.runInNewContext(`${source}\nPianoRollController`, {
  Controller: class {}, Tone, createPhraseInstrument,
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
  document: dom,
  Rational, Duration, ScoreBuilder,
  Pitch: { fromMidi: (midi) => ({ toString: () => `MIDI-${midi}` }) },
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  setInterval: () => 1, clearInterval: () => {}
})

/** Cria um editor mínimo para testar os gestos musicais reais, sem renderizar Canvas. */
function editor(notes = [{ id: "note-1", pitch: 60, onset: 480, duration: 480, velocity: 100 }]) {
  const instance = Object.create(PianoRollController.prototype)
  instance.notes = notes
  instance.selectedNoteIds = new Set()
  instance.ticksPerQuarter = 480
  instance.totalTicks = 7680
  instance.minPitch = 36
  instance.maxPitch = 84
  instance.rowHeight = 22
  instance.pixelsPerQuarter = 88
  instance.gridQuarter = 1
  instance.snapEnabled = true
  instance.nextNoteId = 2
  instance.keyboardCursor = { pitch: 60, onset: 0 }
  instance.element = { contains: () => true }
  instance.loopStartTick = 0
  instance.loopEndTick = 7680
  instance.loopEnabled = true
  instance.isPlaying = false
  instance.playbackGeneration = 0
  instance.statusTarget = { textContent: "" }
  instance.playheadTarget = { style: {} }
  instance.loopStartLineTarget = { style: {} }
  instance.loopEndLineTarget = { style: {} }
  instance.rollTarget = { focus() {}, setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() { return true }, style: {} }
  instance.pointerPoint = (event) => ({ x: event.x, y: event.y })
  instance.render = () => {}
  instance.updateSummary = () => {}
  instance.commitScore = () => {}
  instance.dispatch = () => {}
  return instance
}

/** Simula um evento de ponteiro sobre a grade nas coordenadas musicais de teste. */
function pointer(x, y, shiftKey = false) {
  return { x, y, shiftKey, pointerId: 7, button: 0, preventDefault() {} }
}

test("calcula score e limites de um compasso 6 por 8", () => {
  const instance = editor([])
  instance.totalTicks = 1440
  instance.hasTimeNumeratorValue = true
  instance.timeNumeratorValue = 6
  instance.hasTimeDenominatorValue = true
  instance.timeDenominatorValue = 8
  assert.equal(instance.measureTicks(), 1440)
  const score = instance.buildScore()
  assert.equal(score.measures.length, 1)
  assert.equal(score.measures[0].timeSignature.numerator, 6)
  assert.equal(score.measures[0].durationQuarters.numerator, 3)
  assert.equal(score.measures[0].durationQuarters.denominator, 1)
})

test("compasso parcial e grade grande nao criam nota alem da regiao", () => {
  const instance = editor([])
  instance.totalTicks = 720
  instance.loopEndTick = 720
  instance.noteAt = () => null
  instance.pointerDown(pointer(instance.musicToPixels(600), instance.pitchToPixels(60) + 10))
  instance.pointerMove(pointer(instance.musicToPixels(900), instance.pitchToPixels(60) + 10))
  assert.ok(instance.notes[0].onset + instance.notes[0].duration <= 720)
  const score = instance.buildScore()
  assert.equal(score.measures.length, 1)
  assert.equal(score.measures[0].durationQuarters.numerator, 3)
  assert.equal(score.measures[0].durationQuarters.denominator, 2)
})

test("regiao menor que a grade mantem loop e nota dentro dos limites", () => {
  const instance = editor([])
  instance.totalTicks = 240
  instance.loopEndTick = 240
  instance.noteAt = () => null
  instance.setLoopBoundary("start", 120)
  assert.equal(instance.loopStartTick, 0)
  instance.pointerDown(pointer(instance.musicToPixels(120), instance.pitchToPixels(60) + 10))
  assert.equal(instance.notes[0].onset, 0)
  assert.equal(instance.notes[0].duration, 240)
})

test("modo persistido carrega extremos MIDI e pecas extras de bateria", () => {
  const instance = editor([])
  instance.hasPersistentModeValue = true
  instance.persistentModeValue = true
  instance.initialNotesValue = [
    { id: "low", pitch: 0, onset: 0, duration: 480, velocity: 1 },
    { id: "high", pitch: 127, onset: 480, duration: 480, velocity: 127 }
  ]
  instance.loadInitialNotes()
  assert.deepEqual(instance.notes.map((note) => note.pitch), [0, 127])
  instance.hasLayoutValue = true
  instance.layoutValue = "drums"
  instance.initialNotesValue = [{ id: "ride", pitch: 49, onset: 0, duration: 480, velocity: 90 }]
  instance.loadInitialNotes()
  assert.deepEqual(instance.notes.map((note) => note.pitch), [49])
  assert.ok(instance.displayPitches().includes(49))
})

test("região vazia abre viewport junto ao Dó4 sem descartar extremos MIDI", () => {
  const instance = editor([])
  instance.hasPersistentModeValue = true
  instance.persistentModeValue = true
  instance.rollViewportTarget = { clientHeight: 365, scrollTop: 0 }
  instance.syncViewport = () => {}
  instance.revealInitialPitch()
  assert.ok(instance.rollViewportTarget.scrollTop > 1000)
  assert.ok(instance.rollViewportTarget.scrollTop < instance.pitchToPixels(60))
  assert.equal(instance.displayPitches().length, 128)
})

test("arraste sem snap mantém deslocamento em ticks inteiros", () => {
  const instance = editor()
  instance.snapEnabled = false
  const y = instance.pitchToPixels(60) + 11
  instance.pointerDown(pointer(130, y))
  instance.pointerMove(pointer(137, y))
  instance.pointerUp(pointer(137, y))
  assert.equal(Number.isInteger(instance.notes[0].onset), true)
})

test("prévia e agulha respeitam BPM da composição persistida", async () => {
  const instance = editor([{ id: "slow", pitch: 60, onset: 0, duration: 480, velocity: 100 }])
  instance.hasBpmValue = true
  instance.bpmValue = 60
  await instance.play()
  assert.equal(instance.instrument.events[0][1], 1)
  assert.equal(instance.playbackDuration, 16)
  assert.equal(Math.round(instance.playheadTickAt(instance.playbackStartedAt + 1)), 480)
  instance.stop()
})

test("rótulo do cursor usa tempos do compasso 6 por 8", () => {
  const instance = editor([])
  instance.timeNumerator = 6
  instance.timeDenominator = 8
  instance.keyboardCursor.onset = 720
  assert.match(instance.keyboardCursorStatus(), /compasso 1, tempo 4/)
})

test("atualiza compasso e duracao da regiao sem deslocar notas", () => {
  const instance = editor()
  instance.resizeCanvases = () => {}
  instance.buildScore = () => ({})
  instance.setMusicalContext({ totalTicks: 2880, numerator: 6, denominator: 8 })
  assert.equal(instance.totalTicks, 2880)
  assert.equal(instance.measureTicks(), 1440)
  assert.equal(instance.notes[0].onset, 480)
  assert.equal(instance.notes[0].duration, 480)
})

test("a borda direita visível continua selecionável a dez pixels do fim", () => {
  const instance = editor()
  const note = instance.notes[0]
  assert.equal(instance.noteEdge({ x: instance.musicToPixels(note.onset + note.duration) - 10, y: instance.pitchToPixels(60) + 11 }, note), "resize-right")
})

test("notas recebidas são copiadas e o próximo ID não colide ao criar", () => {
  const instance = editor([])
  const initial = [{ id: "note-7", pitch: 60, onset: 480, duration: 480, velocity: 90 }]
  instance.initialNotesValue = initial
  instance.loadInitialNotes()
  initial[0].pitch = 72
  assert.equal(instance.notes[0].pitch, 60)
  assert.equal(instance.nextNoteId, 8)
  assert.deepEqual(JSON.parse(JSON.stringify(instance.snapshotNotes())), [{ id: "note-7", pitch: 60, onset: 480, duration: 480, velocity: 90 }])
})

test("uma edição confirmada emite cópia das notas, sem disparo na montagem", () => {
  const instance = editor()
  const events = []
  instance.dispatch = (name, payload) => events.push({ name, payload })
  instance.buildScore = () => ({})
  instance.loadInitialNotes()
  assert.equal(events.length, 0)
  PianoRollController.prototype.commitScore.call(instance)
  instance.notes[0].pitch = 72
  assert.equal(events[0].name, "notes-changed")
  assert.equal(events[0].payload.detail.notes[0].pitch, 60)
})

test("arraste confirma uma única operação e não confirma seleção vazia", () => {
  const instance = editor([])
  const events = []
  instance.dispatch = (name, payload) => events.push({ name, payload })
  instance.buildScore = () => ({})
  instance.noteAt = () => null
  const y = instance.pitchToPixels(60) + 11
  instance.pointerDown(pointer(20, y))
  instance.pointerMove(pointer(100, y))
  instance.pointerMove(pointer(180, y))
  instance.pointerUp(pointer(180, y))
  assert.equal(events.filter((event) => event.name === "notes-committed").length, 1)
  assert.equal(events.find((event) => event.name === "notes-committed").payload.detail.notes[0].duration, 960)
  instance.pointerDown(pointer(300, y, true))
  instance.pointerUp(pointer(300, y, true))
  assert.equal(events.filter((event) => event.name === "notes-committed").length, 1)
})

test("modo persistido solicita ID síncrono para mouse e teclado", () => {
  const instance = editor([])
  instance.hasPersistentModeValue = true
  instance.persistentModeValue = true
  instance.noteAt = () => null
  let next = 1
  instance.element.dispatchEvent = (event) => { event.detail.id = `global-${next++}` }
  instance.pointerDown(pointer(20, instance.pitchToPixels(60) + 11))
  instance.pointerUp(pointer(20, instance.pitchToPixels(60) + 11))
  instance.handleKeyDown({ key: "ArrowRight", preventDefault() {} })
  instance.handleKeyDown({ key: "Enter", preventDefault() {} })
  assert.deepEqual(instance.notes.map((note) => note.id), ["global-1", "global-2"])
  instance.element.dispatchEvent = () => {}
  instance.handleKeyDown({ key: "ArrowRight", preventDefault() {} })
  assert.throws(() => instance.handleKeyDown({ key: "Enter", preventDefault() {} }), /ID/)
})

test("duração, velocity e exclusão confirmam; restauração não emite eventos", () => {
  const instance = editor()
  const events = []
  instance.dispatch = (name, payload) => events.push({ name, payload })
  instance.buildScore = () => ({})
  instance.selectedNoteIds.add("note-1")
  instance.changeDuration({ currentTarget: { value: "2" } })
  instance.changeVelocity({ currentTarget: { value: "127" } })
  assert.equal(instance.notes[0].velocity, 127)
  instance.changeVelocity({ currentTarget: { value: "0" } })
  assert.equal(instance.notes[0].velocity, 127)
  instance.handleKeyDown({ key: "Delete", preventDefault() {} })
  assert.equal(events.filter((event) => event.name === "notes-committed").length, 3)
  const count = events.length
  instance.replaceNotes([{ id: "restored", pitch: 62, onset: 0, duration: 480, velocity: 80 }])
  assert.equal(events.length, count)
  assert.equal(instance.notes[0].id, "restored")
})

test("bateria usa o kit para tocar uma batida MIDI", async () => {
  const instance = editor()
  instance.notes[0].pitch = 36
  instance.hasLayoutValue = true
  instance.layoutValue = "drums"
  instance.instrumentIdValue = "drums"
  instance.hasAudioEnabledValue = true
  instance.audioEnabledValue = true
  await instance.play()
  assert.equal(instance.isPlaying, true)
  assert.equal(instance.instrument.id, "drums")
  assert.deepEqual(instance.instrument.events[0], [36, 0.5, 10.55])
})

test("falha de amostra informa o erro, preserva notas e aceita nova tentativa", async () => {
  const instance = editor()
  failInstrumentLoad = true
  try {
    await instance.play()
    assert.equal(instance.isPlaying, false)
    assert.match(instance.statusTarget.textContent, /áudio/i)
    assert.equal(instance.notes.length, 1)
    failInstrumentLoad = false
    await instance.play()
    assert.equal(instance.isPlaying, true)
  } finally {
    failInstrumentLoad = false
    instance.stop()
  }
})

test("fechar durante o carregamento descarta o timbre sem tocar eventos antigos", async () => {
  const instance = editor()
  deferInstrumentLoad = true
  try {
    const pending = instance.play()
    for (let attempt = 0; attempt < 8 && !resolveInstrumentLoad; attempt += 1) await Promise.resolve()
    const oldInstrument = instance.instrument
    instance.stop()
    resolveInstrumentLoad()
    await pending
    assert.equal(oldInstrument.disposed, true)
    assert.equal(oldInstrument.events.length, 0)
    assert.equal(instance.isPlaying, false)
  } finally {
    deferInstrumentLoad = false
  }
})

test("falha atrasada não descarta o instrumento de uma tentativa nova", async () => {
  const instance = editor()
  let rejectOld
  const oldInstrument = { load: () => new Promise((_, reject) => { rejectOld = reject }), dispose() { this.disposed = true } }
  const newInstrument = { load: async () => {}, dispose() { this.disposed = true } }
  instance.instrument = oldInstrument
  const oldLoad = instance.loadInstrument()
  oldInstrument.dispose()
  instance.instrument = newInstrument
  await instance.loadInstrument()
  rejectOld(new Error("amostra antiga ausente"))
  await assert.rejects(oldLoad, /amostra antiga/)
  assert.equal(instance.instrument, newInstrument)
  assert.equal(newInstrument.disposed, undefined)
})

test("teclado visual da Bateria mostra somente as três peças nomeadas", () => {
  const instance = editor()
  instance.hasLayoutValue = true
  instance.layoutValue = "drums"
  instance.hasAudioEnabledValue = true
  instance.audioEnabledValue = true
  instance.keyboardTarget = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value }, replaceChildren(child) { this.child = child } }
  instance.buildKeyboard()
  assert.equal(instance.keyboardTarget.child.children.length, 3)
  assert.deepEqual(instance.keyboardTarget.child.children.map((key) => key.textContent), ["Chimbal", "Caixa", "Bumbo"])
  assert.equal(instance.keyboardTarget.child.children[0].tagName, "BUTTON")
  assert.equal(instance.keyboardTarget.child.children[0].listens, true)
  assert.equal(instance.keyboardTarget.attributes["aria-hidden"], "false")
})

test("bateria mapeia ponteiro e setas apenas para 42, 38 e 36", () => {
  const instance = editor([])
  instance.hasLayoutValue = true
  instance.layoutValue = "drums"
  instance.keyboardCursor.pitch = 36
  assert.equal(instance.pixelsToPitch(0), 42)
  assert.equal(instance.pixelsToPitch(22), 38)
  assert.equal(instance.pixelsToPitch(44), 36)
  instance.handleKeyDown({ key: "ArrowUp", preventDefault() {} })
  assert.equal(instance.keyboardCursor.pitch, 38)
  instance.handleKeyDown({ key: "ArrowUp", preventDefault() {} })
  assert.equal(instance.keyboardCursor.pitch, 42)
  instance.handleKeyDown({ key: "ArrowUp", preventDefault() {} })
  assert.equal(instance.keyboardCursor.pitch, 42)
  instance.handleKeyDown({ key: "Enter", preventDefault() {} })
  assert.equal(instance.notes[0].pitch, 42)
})

test("bateria ignora notas antigas fora do kit ao receber um snapshot", () => {
  const instance = editor([])
  instance.hasLayoutValue = true
  instance.layoutValue = "drums"
  instance.initialNotesValue = [
    { id: "note-1", pitch: 60, onset: 0, duration: 480, velocity: 100 },
    { id: "note-2", pitch: 38, onset: 480, duration: 480, velocity: 100 }
  ]
  instance.loadInitialNotes()
  assert.deepEqual(instance.notes.map((note) => note.pitch), [38])
})

test("foco em link não captura Espaço para o transporte", async () => {
  const instance = editor()
  let prevented = false
  await instance.handleTransportKeyDown({ key: " ", code: "Space", repeat: false, target: { closest: (selector) => selector.split(",").some((part) => part.trim() === "a") ? {} : null }, preventDefault() { prevented = true } })
  assert.equal(prevented, false)
  assert.equal(instance.isPlaying, false)
})

test("setas posicionam cursor musical e Enter cria ou seleciona nota pelo teclado", () => {
  const instance = editor([])
  let commits = 0
  instance.commitScore = () => { commits += 1 }
  const key = (value) => ({ key: value, preventDefault() {} })
  instance.handleKeyDown(key("ArrowRight"))
  instance.handleKeyDown(key("ArrowUp"))
  instance.handleKeyDown(key("Enter"))
  assert.deepEqual(JSON.parse(JSON.stringify(instance.notes)), [{ id: "note-2", pitch: 61, onset: 480, duration: 480, velocity: 100 }])
  assert.equal(commits, 1)
  instance.handleKeyDown(key("Enter"))
  assert.equal(instance.notes.length, 1)
  assert.equal(instance.selectedNoteIds.has("note-2"), true)
  assert.match(instance.statusTarget.textContent, /C#4/)
})

test("prévia de tecla pendente não cria instrumento após fechar a frase", async () => {
  const instance = editor()
  instance.playbackGeneration = 0
  let releaseAudio
  Tone.start = () => new Promise((resolve) => { releaseAudio = resolve })
  try {
    const pending = instance.previewPitch(60)
    instance.stop()
    releaseAudio()
    await pending
    assert.equal(instance.instrument, null)
  } finally {
    Tone.start = async () => {}
  }
})

test("arrastar a alça direita altera a duração sem mover o início", () => {
  const instance = editor()
  const y = instance.pitchToPixels(60) + 11
  instance.pointerDown(pointer(166, y))
  instance.pointerMove(pointer(264, y))
  instance.pointerUp(pointer(264, y))
  assert.equal(instance.notes[0].onset, 480)
  assert.equal(instance.notes[0].duration, 960)
})

test("o controle de duração aplica uma mínima à nota selecionada", () => {
  const instance = editor()
  instance.selectedNoteIds.add("note-1")
  instance.changeDuration({ currentTarget: { value: "2" } })
  assert.equal(instance.notes[0].duration, 960)
})

test("Shift mais arraste seleciona notas na área sem criar outra nota", () => {
  const instance = editor([
    { id: "note-1", pitch: 60, onset: 480, duration: 480, velocity: 100 },
    { id: "note-2", pitch: 64, onset: 960, duration: 480, velocity: 100 }
  ])
  instance.pointerDown(pointer(20, 560, true))
  instance.pointerMove(pointer(280, 430, true))
  instance.pointerUp(pointer(280, 430, true))
  assert.equal(instance.notes.length, 2)
  assert.deepEqual([...instance.selectedNoteIds].sort(), ["note-1", "note-2"])
})

test("ao mover um grupo até o começo, as notas mantêm sua distância", () => {
  const instance = editor([
    { id: "note-1", pitch: 60, onset: 480, duration: 480, velocity: 100 },
    { id: "note-2", pitch: 64, onset: 960, duration: 480, velocity: 100 }
  ])
  instance.selectedNoteIds = new Set(["note-1", "note-2"])
  const y = instance.pitchToPixels(60) + 11
  instance.pointerDown(pointer(132, y))
  instance.pointerMove(pointer(-100, y))
  instance.pointerUp(pointer(-100, y))
  assert.equal(instance.notes[0].onset, 0)
  assert.equal(instance.notes[1].onset, 480)
})

test("a agulha cobre a altura inteira da grade após o redimensionamento", () => {
  const instance = editor()
  instance.rollTarget = {}
  instance.rulerTarget = {}
  instance.velocityTarget = {}
  instance.playheadTarget = { style: {} }
  instance.keyboardTarget = { style: { setProperty() {} } }
  instance.canvasSize = () => {}
  instance.syncViewport = () => {}
  instance.resizeCanvases()
  assert.equal(instance.playheadTarget.style.height, "1078px")
})

test("redimensionar uma nota no último passo não ultrapassa o quarto compasso", () => {
  const instance = editor([{ id: "note-1", pitch: 60, onset: 7560, duration: 120, velocity: 100 }])
  const y = instance.pitchToPixels(60) + 11
  instance.pointerDown(pointer(1400, y))
  instance.pointerMove(pointer(1500, y))
  instance.pointerUp(pointer(1500, y))
  assert.equal(instance.notes[0].onset + instance.notes[0].duration, 7680)
})

test("os marcadores respeitam a grade e não se cruzam", () => {
  const instance = editor()
  instance.setLoopBoundary("end", 1080)
  assert.equal(instance.loopEndTick, 960)
  instance.setLoopBoundary("start", 1800)
  assert.equal(instance.loopStartTick, 480)
  instance.setLoopBoundary("start", -100)
  assert.equal(instance.loopStartTick, 0)
})

test("o loop toca apenas notas iniciadas no intervalo e corta as que cruzam o fim", () => {
  const instance = editor([
    { id: "before", pitch: 59, onset: 0, duration: 960, velocity: 100 },
    { id: "inside", pitch: 60, onset: 480, duration: 1200, velocity: 100 },
    { id: "last", pitch: 64, onset: 960, duration: 960, velocity: 100 },
    { id: "after", pitch: 67, onset: 1440, duration: 480, velocity: 100 }
  ])
  instance.loopStartTick = 480
  instance.loopEndTick = 1440
  assert.deepEqual(JSON.parse(JSON.stringify(instance.loopEvents())), [
    { pitch: 60, offsetSeconds: 0, durationSeconds: 1 },
    { pitch: 64, offsetSeconds: 0.5, durationSeconds: 0.5 }
  ])
})

test("o agendamento repete o padrão no início do ciclo seguinte", () => {
  const instance = editor()
  instance.loopStartTick = 480
  instance.loopEndTick = 960
  instance.nextCycleAt = 10
  instance.nextCycleTick = 480
  instance.playbackDuration = 0.5
  instance.isPlaying = true
  const scheduled = []
  instance.instrument = { trigger: (...args) => scheduled.push(args) }
  instance.scheduleAhead(10)
  instance.scheduleAhead(10.4)
  assert.deepEqual(scheduled.map((event) => event[2]), [10, 10.5])
})

test("a agulha de reprodução volta ao início a cada ciclo", () => {
  const instance = editor()
  instance.loopStartTick = 480
  instance.loopEndTick = 1440
  instance.playbackStartedAt = 10
  instance.playbackDuration = 1
  assert.equal(instance.playheadTickAt(10.25), 720)
  assert.equal(instance.playheadTickAt(11.25), 720)
})

test("retomar após pausa agenda áudio e agulha a partir do tick preservado", async () => {
  const instance = editor([{ id: "note-1", pitch: 60, onset: 480, duration: 960, velocity: 100 }])
  instance.loopStartTick = 480
  instance.loopEndTick = 1440
  instance.currentTick = 960
  await instance.play()
  assert.equal(instance.playheadTickAt(10), 960)
  assert.equal(instance.playheadTickAt(10.05), 960)
  assert.deepEqual(instance.instrument.events[0], [60, 0.5, 10.05])
  assert.equal(instance.nextCycleAt, 10.55)
})

test("após o trecho retomado, o próximo ciclo volta ao início completo do loop", async () => {
  const instance = editor([{ id: "note-1", pitch: 60, onset: 480, duration: 960, velocity: 100 }])
  instance.loopStartTick = 480
  instance.loopEndTick = 1440
  instance.currentTick = 960
  await instance.play()
  instance.scheduleAhead(10.4)
  assert.deepEqual(instance.instrument.events[1], [60, 1, 10.55])
})

test("Espaço alterna reprodução e parada sem capturar controles ou repetição", async () => {
  const instance = editor()
  const key = (overrides = {}) => ({ key: " ", code: "Space", timeStamp: 1000, repeat: false, target: { closest: () => null }, preventDefault() {}, ...overrides })
  await instance.handleTransportKeyDown(key())
  assert.equal(instance.isPlaying, true)
  await instance.handleTransportKeyDown(key({ repeat: true }))
  assert.equal(instance.isPlaying, true)
  await instance.handleTransportKeyDown(key({ target: { closest: () => ({}) } }))
  assert.equal(instance.isPlaying, true)
  await instance.handleTransportKeyDown(key({ timeStamp: 1400 }))
  assert.equal(instance.isPlaying, false)
})

test("Espaço simples para mantendo a agulha; dois toques rápidos a devolvem ao início sem mudar o loop", async () => {
  const instance = editor()
  instance.loopStartTick = 480
  instance.loopEndTick = 1440
  instance.playbackStartedAt = 9.5
  instance.playbackDuration = 1
  instance.isPlaying = true
  instance.currentTick = 960
  const key = (timeStamp) => ({ key: " ", code: "Space", timeStamp, repeat: false, target: { closest: () => null }, preventDefault() {} })
  await instance.handleTransportKeyDown(key(1000))
  assert.equal(instance.isPlaying, false)
  assert.equal(instance.currentTick, 960)
  assert.equal(instance.statusTarget.textContent, "Reprodução pausada")
  await instance.handleTransportKeyDown(key(1400))
  assert.equal(instance.isPlaying, true)
  await instance.handleTransportKeyDown(key(1600))
  assert.equal(instance.isPlaying, false)
  assert.equal(instance.currentTick, 480)
  assert.equal(instance.statusTarget.textContent, "Reprodução parada")
  assert.equal(instance.loopStartTick, 480)
  assert.equal(instance.loopEndTick, 1440)
})

test("clique direito exclui só a nota atingida e mantém as outras selecionadas", () => {
  const instance = editor([
    { id: "note-1", pitch: 60, onset: 480, duration: 480, velocity: 100 },
    { id: "note-2", pitch: 64, onset: 960, duration: 480, velocity: 100 }
  ])
  instance.selectedNoteIds = new Set(["note-1", "note-2"])
  let prevented = false
  instance.handleNoteContextMenu({ x: 132, y: instance.pitchToPixels(60) + 11, preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(instance.notes.map((note) => note.id), ["note-2"])
  assert.deepEqual([...instance.selectedNoteIds], ["note-2"])
})

test("clique direito na grade vazia mantém o menu de contexto do navegador", () => {
  const instance = editor()
  let prevented = false
  instance.handleNoteContextMenu({ x: 20, y: 20, preventDefault() { prevented = true } })
  assert.equal(prevented, false)
  assert.equal(instance.notes.length, 1)
})
