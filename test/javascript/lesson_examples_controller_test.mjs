import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

/** Exercita o controlador real com relógio e fontes sonoras substituídos. */
function setup({ fail = false, loadFail = false } = {}) {
  const calls = [], voices = [], gains = []
  let frame, time = 20
  const source = readFileSync(new URL("../../app/javascript/controllers/lesson_examples_controller.js", import.meta.url), "utf8")
    .replace(/^import .*$/gm, "").replace("export default class extends Controller", "class Examples extends Controller") + "\nExamples"
  const Examples = vm.runInNewContext(source, {
    Controller: class {}, JSON, Number, performance: { now: () => time * 1000 },
    Tone: { start: async () => { if (fail) throw Error("audio") }, now: () => time + .1, immediate: () => time,
      Frequency: note => ({ toMidi: () => ({ C4: 60, D4: 62 }[note]) }),
      Gain: class { constructor(value) { this.value = value; gains.push(this) } toDestination() { return this }
        dispose() { this.disposed = true } },
      Synth: class { constructor(options) { this.options = options; voices.push(this) } toDestination() { return this }
        triggerAttackRelease(...args) { calls.push(args) } dispose() { this.disposed = true } } },
    createPhraseInstrument: (id, { destination }) => {
      const voice = { id, destination, load: async () => { if (loadFail) throw Error("sample") },
        trigger: (...args) => calls.push(args), dispose() { this.disposed = true } }
      voices.push(voice)
      return voice
    },
    requestAnimationFrame: fn => { frame = fn; return 1 }, cancelAnimationFrame: () => { frame = null },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} }
  })
  const instance = new Examples()
  instance.statusTarget = { textContent: "" }
  instance.stopTarget = { disabled: true }
  instance.playTargets = [{ disabled: false, dataset: {} }, { disabled: false, dataset: {} }]
  instance.progressTargets = [{ value: 0 }, { value: 0 }]
  instance.connect()
  const button = { disabled: false, dataset: { events: JSON.stringify([{ at: 0, duration: 2, pitch: "C4", velocity: .4 }, { at: 3, duration: 1, pitch: "D4", velocity: .5 }]), beats: "4", bpm: "60", instrument: "piano", title: "Exemplo" } }
  instance.playTargets[0] = button
  return { instance, button, calls, voices, gains, tick(value) { time = value; frame?.() } }
}

test("agenda ataques e duracoes musicais sem tocar antes do comando", async () => {
  const s = setup()
  assert.equal(s.calls.length, 0)
  await s.instance.play({ currentTarget: s.button })
  assert.equal(s.calls.length, 2)
  assert.equal(s.voices[0].id, "piano")
  assert.equal(s.calls[0][0], 60)
  assert.equal(s.calls[0][1], 2)
  assert.equal(s.calls[1][2] - s.calls[0][2], 3)
  s.tick(24.2)
  assert.equal(s.voices[0].disposed, true)
})

test("parar durante preparo impede eventos tardios", async () => {
  const s = setup()
  const pending = s.instance.play({ currentTarget: s.button })
  s.instance.stop()
  await pending
  assert.equal(s.calls.length, 0)
})

test("falha de audio libera nova tentativa e informa o problema", async () => {
  const s = setup({ fail: true })
  await s.instance.play({ currentTarget: s.button })
  assert.equal(s.instance.playTargets[0].disabled, false)
  assert.match(s.instance.statusTarget.textContent, /áudio/i)
})

// A amostra do piano precisa carregar antes dos ataques e manter ganho próprio da aula.
test("exemplos carregam o piano e usam ganho audivel sem alterar o editor", async () => {
  const s = setup()
  await s.instance.play({ currentTarget: s.button })
  assert.equal(s.gains[0].value, 4)
  assert.equal(s.voices[0].destination, s.gains[0])
  s.instance.stop()
  assert.equal(s.gains[0].disposed, true)
})

test("falha no carregamento da amostra informa o problema e libera recursos", async () => {
  const s = setup({ loadFail: true })
  await s.instance.play({ currentTarget: s.button })
  assert.equal(s.calls.length, 0)
  assert.equal(s.voices[0].disposed, true)
  assert.equal(s.gains[0].disposed, true)
  assert.match(s.instance.statusTarget.textContent, /áudio/i)
})

test("comparacao didatica pode usar onda senoidal identificada", async () => {
  const s = setup()
  s.button.dataset.instrument = "sine"
  await s.instance.play({ currentTarget: s.button })
  assert.equal(s.voices[0].options.oscillator.type, "sine")
  assert.equal(s.calls[0][0], "C4")
  assert.equal(s.gains.length, 0)
})

// O desenho deve seguir o carregamento real, inclusive em cancelamentos.
test("controle de exemplo mostra carregamento, execução e repouso", async () => {
  const s = setup()
  const pending = s.instance.play({ currentTarget: s.button })
  assert.equal(s.button.dataset.audioState, "loading")
  await pending
  assert.equal(s.button.dataset.audioState, "playing")
  s.instance.stop()
  assert.equal(s.button.dataset.audioState, "idle")
})

test("falha no exemplo devolve o violão ao estado inicial", async () => {
  const s = setup({ loadFail: true })
  await s.instance.play({ currentTarget: s.button })
  assert.equal(s.button.dataset.audioState, "idle")
})
