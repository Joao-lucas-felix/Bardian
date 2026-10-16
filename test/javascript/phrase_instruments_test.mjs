import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// A borda de áudio é substituída; o contrato do catálogo permanece real.
const source = readFileSync(new URL("../../app/javascript/audio/phrase_instruments.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export function createPhraseInstrument", "function createPhraseInstrument")
const samplers = []
const players = []
let failLoad = false
const Tone = {
  Sampler: class {
    constructor(options) { this.options = options; this.events = []; samplers.push(this) }
    toDestination() { return this }
    connect(destination) { this.destination = destination; return this }
    triggerAttackRelease(...args) { this.events.push(args) }
    dispose() { this.disposed = true }
  },
  Player: class {
    constructor(options = {}) { this.options = options; this.buffer = options.url || { sample: true }; this.volume = { value: 0 } }
    toDestination() { players.push(this); return this }
    connect(destination) { this.destination = destination; players.push(this); return this }
    load(url) { this.url = url; return failLoad ? Promise.reject(new Error("sem amostra")) : Promise.resolve() }
    start(time) { this.startedAt = time }
    dispose() { this.disposeCount = (this.disposeCount || 0) + 1; this.disposed = true; this.options.onstop?.() }
  }
}
const createPhraseInstrument = vm.runInNewContext(`${source}\ncreatePhraseInstrument`, { Tone })

test("piano e cordas apontam para amostras locais de instrumentos distintos", async () => {
  const piano = createPhraseInstrument("piano")
  const strings = createPhraseInstrument("strings")
  const pianoLoad = piano.load()
  assert.equal(samplers.at(-1).options.baseUrl, "/audio/salamander/")
  assert.equal(samplers.at(-1).options.urls.A4, "A4.mp3")
  assert.equal(samplers.at(-1).options.volume, -12)
  samplers.at(-1).options.onload()
  await pianoLoad
  const stringsLoad = strings.load()
  assert.equal(samplers.at(-1).options.baseUrl, "/audio/strings/")
  assert.equal(samplers.at(-1).options.volume, -6)
  assert.ok(Object.keys(samplers.at(-1).options.urls).length >= 3)
  assert.equal(samplers.at(-1).options.urls.C4, "C4.mp3")
  samplers.at(-1).options.onload()
  await stringsLoad
  strings.trigger(60, 0.5, 10)
  assert.deepEqual(samplers.at(-1).events[0], ["C4", 0.5, 10])
  piano.dispose()
  strings.dispose()
})

test("kit toca só as três alturas mapeadas e descarta seus players", async () => {
  const kit = createPhraseInstrument("drums")
  await kit.load()
  const loaded = players.slice(-3)
  assert.equal(loaded.length, 3)
  assert.ok(loaded.some((player) => player.url === "/audio/drums/kick.mp3"))
  assert.ok(loaded.some((player) => player.url.includes("snare")))
  assert.ok(loaded.some((player) => player.url.includes("hat")))
  kit.trigger(36, 4, 10)
  kit.trigger(38, 4, 11)
  kit.trigger(42, 4, 12)
  kit.trigger(60, 4, 13)
  const voices = players.slice(-3)
  assert.deepEqual(voices.map((player) => player.startedAt).sort(), [10, 11, 12])
  assert.ok(voices.every((voice) => loaded.some((source) => source.buffer === voice.options.url)))
  kit.dispose()
  assert.ok([...loaded, ...voices].every((player) => player.disposed))
  kit.trigger(36, 1, 14)
  assert.equal(players.length, 6)
})

test("batidas próximas da mesma peça mantêm vozes independentes", async () => {
  const kit = createPhraseInstrument("drums")
  await kit.load()
  const before = players.length
  kit.trigger(42, 0.125, 10)
  kit.trigger(42, 0.125, 10.125)
  const voices = players.slice(before)
  assert.equal(voices.length, 2)
  assert.notEqual(voices[0], voices[1])
  assert.deepEqual(voices.map((voice) => voice.startedAt), [10, 10.125])
  voices[0].options.onstop()
  assert.equal(voices[0].disposed, true)
  assert.equal(voices[1].disposed, undefined)
  kit.dispose()
  assert.equal(voices[1].disposed, true)
  assert.equal(voices[1].disposeCount, 1)
})

test("falha ao carregar pode ser tentada novamente", async () => {
  failLoad = true
  const kit = createPhraseInstrument("drums")
  await assert.rejects(kit.load(), /sem amostra/)
  failLoad = false
  await kit.load()
  kit.trigger(36, 0.1, 20)
  assert.equal(players.at(-1).startedAt, 20)
  kit.dispose()
})

// A mixagem envia vozes à saída da faixa sem mudar o destino das prévias antigas.
test("aceita saída por faixa e intensidade da nota sem alterar padrão anterior", async () => {
  const destination = { id: "faixa" }
  const piano = createPhraseInstrument("piano", { destination })
  const pending = piano.load()
  samplers.at(-1).options.onload()
  await pending
  piano.trigger(60, 0.5, 3, 0.25)
  assert.equal(samplers.at(-1).destination, destination)
  assert.deepEqual(samplers.at(-1).events[0], ["C4", 0.5, 3, 0.25])
  piano.dispose()

  const kit = createPhraseInstrument("drums", { destination })
  await kit.load()
  kit.trigger(36, 0.1, 4, 0.5)
  assert.equal(players.at(-1).destination, destination)
  assert.ok(players.at(-1).volume.value < 0)
  kit.dispose()
})
