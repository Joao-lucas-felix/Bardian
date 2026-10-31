import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Carrega a classe real sem o navegador para exercitar troca, estado e prévia.
const source = readFileSync(new URL("../../app/javascript/controllers/creation_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class CreationController extends Controller")
const waveformCalls = []
const CreationController = vm.runInNewContext(`${source}\nCreationController`, { Controller: class {}, drawPhraseWaveform: (...args) => waveformCalls.push(args), window: { addEventListener() {}, removeEventListener() {} }, document: {
  createElement: (tag) => element(tag)
} })

/** Constrói somente os elementos envolvidos na interação observável do card. */
function element(tag = "div") {
  return {
    tag, dataset: {}, style: {}, children: [], attributes: {}, hidden: false,
    setAttribute(name, value) { this.attributes[name] = String(value) },
    getAttribute(name) { return this.attributes[name] },
    replaceChildren(...children) { this.children.forEach((child) => { child.parentElement = null }); this.children = children; children.forEach((child) => { child.parentElement = this }) },
    append(...children) { children.forEach((child) => { this.children.push(child); child.parentElement = this }) }
  }
}

/** Fornece duas frases e um template que sempre clona um editor novo. */
function page(keys = ["harmony:1", "bass:1"]) {
  const cards = keys.map((key) => {
    const button = element("button")
    button.dataset.creationKeyParam = key
    button.setAttribute("aria-expanded", "false")
    button.setAttribute("aria-label", `Abrir frase de ${key} no Trecho 1`)
    const panel = element()
    panel.hidden = true
    const preview = element()
    const canvas = element("canvas")
    const empty = element("span")
    empty.textContent = "Nenhuma nota ainda"
    preview.nodes = { canvas, empty }
    preview.querySelector = (selector) => ({ canvas, ".midi-phrase-empty": empty })[selector]
    const card = element("article")
    card.dataset.phraseKey = key
    card.dataset.audioEnabled = "true"
    card.dataset.partName = key
    card.querySelector = (selector) => ({ ".midi-phrase-toggle": button, ".midi-phrase-panel": panel, ".midi-phrase-preview": preview })[selector]
    return { card, button, panel, preview }
  })
  const instance = Object.create(CreationController.prototype)
  instance.cardTargets = cards.map(({ card }) => card)
  instance.templateTarget = { content: { firstElementChild: { cloneNode: () => {
    const editor = element("section")
    const play = { disabled: false }
    const subtitle = { textContent: "Arraste para criar e ouvir sua sequência." }
    const help = { before(node) { editor.audioNote = node }, textContent: "" }
    editor.nodes = { play, subtitle, help }
    editor.querySelector = (selector) => ({ ".piano-roll-play": play, ".piano-roll-subtitle": subtitle, ".piano-roll-help": help, ".piano-roll-card-header h2": { textContent: "" } })[selector]
    return editor
  } } } }
  instance.application = { getControllerForElementAndIdentifier: () => ({ stop() { instance.stops = (instance.stops || 0) + 1 } }) }
  instance.connect()
  const click = (index) => instance.toggle({ currentTarget: cards[index].button })
  return { instance, cards, click }
}

test("abrir outra frase recolhe a anterior, desmonta o editor e atualiza ARIA", () => {
  const { instance, cards, click } = page()
  click(0)
  const firstEditor = cards[0].panel.children[0]
  assert.equal(cards[0].button.getAttribute("aria-expanded"), "true")
  assert.match(cards[0].button.getAttribute("aria-label"), /^Fechar/)
  click(1)
  assert.equal(cards[0].button.getAttribute("aria-expanded"), "false")
  assert.match(cards[0].button.getAttribute("aria-label"), /^Abrir/)
  assert.equal(cards[0].panel.hidden, true)
  assert.equal(firstEditor.parentElement, null)
  assert.equal(cards[1].button.getAttribute("aria-expanded"), "true")
  assert.equal(cards[1].panel.children.length, 1)
  assert.equal(instance.stops, 1)
})

test("duas frases guardam notas independentes e reabrem com os mesmos IDs", () => {
  const { instance, cards, click } = page()
  click(0)
  const harmonyEditor = cards[0].panel.children[0]
  const harmonyNote = { id: "note-7", pitch: 60, onset: 0, duration: 480, velocity: 100 }
  instance.notesChanged({ target: harmonyEditor, detail: { notes: [harmonyNote] } })
  harmonyNote.pitch = 72
  click(1)
  const bassEditor = cards[1].panel.children[0]
  instance.notesChanged({ target: bassEditor, detail: { notes: [{ id: "note-1", pitch: 48, onset: 960, duration: 480, velocity: 80 }] } })
  instance.notesChanged({ target: harmonyEditor, detail: { notes: [] } })
  click(0)
  assert.deepEqual(JSON.parse(cards[0].panel.children[0].dataset.pianoRollInitialNotesValue), [{ id: "note-7", pitch: 60, onset: 0, duration: 480, velocity: 100 }])
  assert.equal(instance.phrases.get("bass:1")[0].pitch, 48)
  assert.equal(cards[0].preview.nodes.empty.hidden, true)
})

test("prévia começa vazia e atualiza Canvas com os eventos da frase", () => {
  const { instance, cards, click } = page()
  assert.equal(cards[0].preview.nodes.empty.hidden, false)
  const prior = waveformCalls.length
  click(0)
  const note = { id: "note-1", pitch: 60, onset: 7560, duration: 480, velocity: 100 }
  instance.notesChanged({ target: cards[0].panel.children[0], detail: { notes: [note] } })
  assert.equal(cards[0].preview.nodes.empty.hidden, true)
  assert.equal(waveformCalls.length, prior + 1)
  assert.equal(waveformCalls.at(-1)[0], cards[0].preview.nodes.canvas)
  assert.equal(waveformCalls.at(-1)[1][0].onset, 7560)
  assert.match(cards[0].preview.getAttribute("aria-label"), /1 nota/)
  assert.equal(page().cards[0].preview.nodes.empty.hidden, false)
})

test("Bateria abre o kit audível em três linhas", () => {
  const { cards, click } = page(["drums:1"])
  click(0)
  const editor = cards[0].panel.children[0]
  assert.equal(editor.nodes.play.disabled, false)
  assert.equal(editor.dataset.pianoRollLayoutValue, "drums")
  assert.equal(editor.dataset.pianoRollInstrumentIdValue, "drums")
})

test("trocar piano por cordas preserva a frase e interrompe o som anterior", () => {
  const { instance, cards, click } = page()
  click(0)
  const note = { id: "note-1", pitch: 60, onset: 0, duration: 480, velocity: 100 }
  instance.notesChanged({ target: cards[0].panel.children[0], detail: { notes: [note] } })
  instance.changeInstrument({ currentTarget: { value: "strings", dataset: { creationKeyParam: "harmony:1" } } })
  assert.equal(instance.stops, 1)
  assert.equal(cards[0].panel.children[0].dataset.pianoRollInstrumentIdValue, "strings")
  assert.equal(JSON.parse(cards[0].panel.children[0].dataset.pianoRollInitialNotesValue)[0].pitch, 60)
  click(1)
  assert.equal(cards[1].panel.children[0].dataset.pianoRollInstrumentIdValue, "piano")
})
