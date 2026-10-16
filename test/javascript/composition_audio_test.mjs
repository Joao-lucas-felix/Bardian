import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Tone.js é a borda externa; ambos os módulos de produção são executados juntos.
const phraseSource = readFileSync(new URL("../../app/javascript/audio/phrase_instruments.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export function createPhraseInstrument", "function createPhraseInstrument")
const audioSource = readFileSync(new URL("../../app/javascript/audio/composition_audio.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export function createCompositionAudio", "function createCompositionAudio")

/** Cria relógio e nós falsos apenas para observar chamadas à biblioteca externa. */
function harness() {
  const samplers = []
  const players = []
  const gains = []
  const callbacks = new Map()
  const timeouts = new Map()
  let nextToken = 1
  let loadFailure = false
  let wallTime = 0
  const transport = {
    seconds: 0,
    start() { this.started = true }, pause() { this.paused = true }, stop() { this.stopped = true },
    scheduleOnce(callback, time) { const token = nextToken++; callbacks.set(token, { callback, time }); return token },
    clear(token) { callbacks.delete(token) }
  }
  const Tone = {
    Transport: transport, start: async () => {}, now: () => wallTime,
    Gain: class {
      constructor(value) { this.gain = { value }; gains.push(this) }
      toDestination() { return this }
      dispose() { this.disposed = true }
    },
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
      load(url) { this.url = url; return loadFailure ? Promise.reject(new Error("sem sample")) : Promise.resolve() }
      start(time) { this.startedAt = time }
      dispose() { this.disposed = true; this.options.onstop?.() }
    }
  }
  const timers = {
    setTimeout(callback, delay) { const token = nextToken++; timeouts.set(token, { callback, at: wallTime + delay / 1000 }); return token },
    clearTimeout(token) { timeouts.delete(token) }
  }
  const make = vm.runInNewContext(`${phraseSource}\n${audioSource}\ncreateCompositionAudio`, { Tone })
  return { create: () => make({ timers }), samplers, players, gains, callbacks, transport,
    failLoad(value) { loadFailure = value },
    fire(token) { const item = callbacks.get(token); callbacks.delete(token); item?.callback(item.time) },
    advance(seconds) {
      wallTime += seconds
      transport.seconds = wallTime
      for (const [token, item] of [...timeouts]) {
        if (item.at <= wallTime) { timeouts.delete(token); item.callback() }
      }
    }
  }
}

// Dois instrumentos simultâneos precisam permanecer independentes no mixer.
test("carrega faixas locais e aplica volume e velocity sem compartilhar saídas", async () => {
  const h = harness()
  const audio = h.create()
  const pianoLoad = audio.loadTrack({ id: "p", instrument_id: "piano", volume: 0.8 })
  h.samplers.at(-1).options.onload()
  await pianoLoad
  const stringsLoad = audio.loadTrack({ id: "s", instrument_id: "strings", volume: 1 })
  h.samplers.at(-1).options.onload()
  await stringsLoad
  audio.trigger("p", 60, 0.5, 2, 64)
  audio.trigger("s", 72, 1, 2, 127)
  assert.notEqual(h.samplers[0].destination, h.samplers[1].destination)
  assert.equal(h.gains[0].gain.value, 0.8)
  assert.ok(h.samplers[0].events[0][3] < 1)
  assert.equal(h.samplers[1].events[0].length, 3)
  audio.setTrackVolume("p", 0)
  assert.equal(h.gains[0].gain.value, 0)
  audio.dispose()
  assert.ok(h.gains.every((gain) => gain.disposed))
})

// Uma edição antes do ataque precisa poder retirar um evento do relógio.
test("cancela evento pendente sem atingir outra faixa", async () => {
  const h = harness()
  const audio = h.create()
  await audio.start()
  const played = []
  const old = audio.schedule(() => played.push("antigo"), 1)
  const kept = audio.schedule(() => played.push("mantido"), 2)
  audio.cancel(old)
  h.fire(old)
  h.fire(kept)
  h.advance(2)
  assert.deepEqual(played, ["mantido"])
  assert.equal(h.transport.started, true)
  audio.pause()
  assert.equal(h.transport.paused, true)
  audio.stop()
  assert.equal(h.transport.stopped, true)
  audio.dispose()
})

// Tone pode chamar cedo; até o ataque real, a edição ainda deve cancelar a nota.
test("cancela após aviso antecipado do Tone antes do instante audível", async () => {
  const h = harness()
  const audio = h.create()
  const played = []
  const token = audio.schedule(() => played.push("antigo"), 1)
  h.fire(token)
  audio.cancel(token)
  h.advance(1)
  assert.deepEqual(played, [])
  audio.dispose()
})

// Fonte defeituosa não derruba a faixa boa, e silêncio imediato afeta vozes ativas.
test("isola falha de carregamento e silencia faixa sem excluir notas", async () => {
  const h = harness()
  const audio = h.create()
  const goodLoad = audio.loadTrack({ id: "p", instrument_id: "piano", volume: 1 })
  h.samplers.at(-1).options.onload()
  await goodLoad
  h.failLoad(true)
  await assert.rejects(audio.loadTrack({ id: "d", instrument_id: "drums", volume: 1 }), /sem sample/)
  audio.silenceTrack("p")
  assert.equal(h.gains[0].gain.value, 0)
  audio.trigger("p", 60, 0.5, 1, 127)
  assert.equal(h.samplers[0].events.length, 1)
  audio.dispose()
})

// Uma altura de bateria sem amostra não pode soar como outra peça por engano.
test("informa pitch de bateria indisponível sem alterar notas", async () => {
  const h = harness()
  const audio = h.create()
  await audio.loadTrack({ id: "d", instrument_id: "drums", volume: 1 })
  assert.equal(audio.trigger("d", 49, 0.25, 1, 100), false)
  assert.equal(h.players.filter((player) => player.startedAt !== undefined).length, 0)
  audio.dispose()
})

// Resposta atrasada de um sampler descartado não pode ativar uma faixa removida.
test("ignora carregamento que termina depois de sair da página", async () => {
  const h = harness()
  const audio = h.create()
  const loading = audio.loadTrack({ id: "p", instrument_id: "piano", volume: 1 })
  audio.dispose()
  h.samplers.at(-1).options.onload()
  await loading
  assert.equal(audio.trigger("p", 60, 0.5, 1, 100), false)
  assert.equal(h.samplers.at(-1).disposed, true)
})
