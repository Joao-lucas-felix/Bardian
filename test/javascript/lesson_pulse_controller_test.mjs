import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

/** Simula o relógio de áudio para conferir os eventos sem depender de saída sonora real. */
function setup({ muted = false, subdivide = false, fail = false, loadFail = false, lookAhead = 0 } = {}) {
  const events = [], voices = [], gains = []
  let time = 10, callback
  const source = readFileSync(new URL("../../app/javascript/controllers/lesson_pulse_controller.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace("export default class extends Controller", "class Pulse extends Controller") + "\nPulse"
  const Pulse = vm.runInNewContext(source, {
    Controller: class {}, performance: { now: () => time * 1000 },
    Tone: { start: async () => { if (fail) throw Error("audio") }, now: () => time + lookAhead, immediate: () => time,
      Gain: class { constructor(value) { this.value = value; gains.push(this) } toDestination() { return this }
        dispose() { this.disposed = true } } },
    createPhraseInstrument: (id, { destination }) => {
      const voice = { id, destination, load: async () => { if (loadFail) throw Error("sample") },
        trigger: (...args) => events.push(args), dispose() { this.disposed = true } }
      voices.push(voice)
      return voice
    },
    requestAnimationFrame: fn => { callback = fn; return 1 }, cancelAnimationFrame() { callback = null },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} }
  })
  const instance = new Pulse()
  instance.tempoTarget = { value: "60" }
  instance.silentTarget = { checked: muted }
  instance.subdivideTarget = { checked: subdivide }
  instance.startTarget = { disabled: false, dataset: {} }
  instance.stopTarget = { disabled: true }
  instance.statusTarget = { textContent: "" }
  instance.counterTarget = { textContent: "" }
  instance.beatTargets = Array.from({ length: 4 }, () => ({ setAttribute(key, value) { this[key] = value } }))
  instance.connect()
  return { instance, events, voices, gains, tick(value) { time = value; callback?.() } }
}

test("inicia apenas por comando e agenda oito tempos no BPM escolhido", async () => {
  const s = setup()
  assert.equal(s.events.length, 0)
  await s.instance.start()
  assert.equal(s.events.length, 8)
  assert.equal(s.voices[0].id, "piano")
  assert.equal(s.events[0][0], 84)
  assert.equal(s.events[1][2] - s.events[0][2], 1)
  s.tick(10.06)
  assert.equal(s.instance.counterTarget.textContent, "Tempo 1 · volta 1 de 2")
  s.tick(18.1)
  assert.equal(s.voices[0].disposed, true)
  assert.equal(s.instance.startTarget.disabled, false)
})

test("duas batidas por tempo preservam andamento e duração total", async () => {
  const s = setup({ subdivide: true })
  s.instance.tempoTarget.value = "120"
  await s.instance.start()
  assert.equal(s.events.length, 16)
  assert.equal(s.events[1][2] - s.events[0][2], .25)
  assert.equal(s.instance.endsAt - s.instance.beginsAt, 4)
})

test("modo silencioso mantém indicação visual e parar libera o áudio", async () => {
  const silent = setup({ muted: true })
  await silent.instance.start()
  assert.equal(silent.events.length, 0)
  silent.tick(10.1)
  assert.match(silent.instance.counterTarget.textContent, /Tempo 1/)
  const sound = setup()
  await sound.instance.start()
  sound.instance.disconnect()
  assert.equal(sound.voices[0].disposed, true)
})

test("falha de áudio é informada e permite nova tentativa", async () => {
  const s = setup({ fail: true })
  await s.instance.start()
  assert.equal(s.instance.startTarget.disabled, false)
  assert.match(s.instance.statusTarget.textContent, /sem som/)
})

test("falha no carregamento do piano libera os recursos e informa o estudante", async () => {
  const s = setup({ loadFail: true })
  await s.instance.start()
  assert.equal(s.events.length, 0)
  assert.equal(s.voices[0].disposed, true)
  assert.equal(s.gains[0].disposed, true)
  assert.match(s.instance.statusTarget.textContent, /sem som/)
})

test("parar durante preparação impede sons tardios", async () => {
  const s = setup()
  const pending = s.instance.start()
  s.instance.stop()
  await pending
  assert.equal(s.events.length, 0)
})

// A indicação deve aguardar a antecedência que o motor usa para agendar o áudio.
test("indicação visual considera a antecedência do relógio de áudio", async () => {
  const s = setup({ lookAhead: .1 })
  await s.instance.start()
  s.tick(10.06)
  assert.equal(s.instance.counterTarget.textContent, "1 · 2 · 3 · 4")
  s.tick(10.16)
  assert.equal(s.instance.counterTarget.textContent, "Tempo 1 · volta 1 de 2")
})

// A prática silenciosa não deve sugerir que as cordas estão soando.
test("controle de pulsação distingue carregamento, execução e prática silenciosa", async () => {
  const sound = setup()
  const pending = sound.instance.start()
  assert.equal(sound.instance.startTarget.dataset.audioState, "loading")
  await pending
  assert.equal(sound.instance.startTarget.dataset.audioState, "playing")
  sound.instance.stop()
  assert.equal(sound.instance.startTarget.dataset.audioState, "idle")

  const silent = setup({ muted: true })
  await silent.instance.start()
  assert.equal(silent.instance.startTarget.dataset.audioState, "silent")
})
