import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import * as events from "../../app/javascript/composition/playback_events.js"

// O relógio externo é substituído, mas o transporte e as regras musicais são reais.
const source = readFileSync(new URL("../../app/javascript/audio/composition_transport.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export function createCompositionTransport", "function createCompositionTransport")

/** Documento curto com ataques simultâneos e uma nota sustentada. */
function music() {
  return { version: 1, id: "song", name: "Ideia", bpm: 120,
    time_signature: { numerator: 4, denominator: 4 },
    loop: { start_tick: 0, end_tick: 960 }, tracks: [
      { id: "p", name: "Piano", instrument_id: "piano", volume: 1, mute: false, solo: false,
        regions: [{ id: "r1", start_tick: 0, duration_ticks: 960, notes: [
          { id: "n1", pitch: 60, onset_tick: 0, duration_ticks: 960, velocity: 100 }
        ] }] },
      { id: "s", name: "Cordas", instrument_id: "strings", volume: 0.8, mute: false, solo: false,
        regions: [{ id: "r2", start_tick: 0, duration_ticks: 960, notes: [
          { id: "n2", pitch: 72, onset_tick: 0, duration_ticks: 480, velocity: 90 }
        ] }] }
    ] }
}

/** Finge apenas Tone.js e o pulso temporal, preservando eventos e transições reais. */
function harness({ failTrack = null, delayedTrack = null } = {}) {
  let time = 0
  let nextToken = 1
  let pulse = null
  const pending = new Map()
  const calls = []
  const states = []
  const loads = new Map()
  const audio = {
    async start() { calls.push(["start"]) },
    pause() { calls.push(["pause"]) }, stop() { calls.push(["stop"]); pending.clear() },
    now() { return time },
    schedule(callback, atSeconds) { const token = nextToken++; pending.set(token, { callback, atSeconds }); return token },
    cancel(token) { pending.delete(token) },
    loadTrack(track) {
      calls.push(["load", track.id])
      if (track.id === failTrack) return Promise.reject(new Error("sem sample"))
      if (track.id === delayedTrack) return new Promise((resolve) => loads.set(track.id, resolve))
      return Promise.resolve()
    },
    trigger(trackId, pitch, duration, atSeconds, velocity) {
      calls.push(["note", trackId, pitch, duration, atSeconds, velocity]); return true
    },
    setTrackVolume(trackId, volume) { calls.push(["volume", trackId, volume]) },
    silenceTrack(trackId) { calls.push(["silence", trackId]) },
    disposeTrack(trackId) { calls.push(["disposeTrack", trackId]) },
    dispose() { pending.clear(); calls.push(["dispose"]) }
  }
  const timer = { setInterval(fn) { pulse = fn; return 1 }, clearInterval() { pulse = null } }
  const create = vm.runInNewContext(`${source}\ncreateCompositionTransport`, { ...events })
  const transport = create({ audio, onState: (state) => states.push(state), timer })
  return { audio, transport, calls, states, pending, loads,
    advance(seconds) {
      time += seconds
      pulse?.()
      for (const [token, item] of [...pending]) {
        if (item.atSeconds <= time) { pending.delete(token); item.callback(item.atSeconds) }
      }
    }
  }
}

// O mesmo relógio precisa disparar duas faixas sem serializar ataques simultâneos.
test("reproduz duas faixas juntas e repete no próximo ciclo", async () => {
  const h = harness()
  await h.transport.play(music())
  h.advance(0.01)
  assert.deepEqual(h.calls.filter((call) => call[0] === "note").map((call) => call[1]), ["p", "s"])
  h.advance(1)
  assert.equal(h.calls.filter((call) => call[0] === "note" && call[1] === "p").length, 2)
  assert.equal(h.states.at(-1).status, "playing")
  h.transport.dispose()
})

// Pausar conserva o tick; retomar inicia apenas o resto de uma nota sustentada.
test("pausa retoma a cauda e para no início do loop", async () => {
  const h = harness()
  await h.transport.play(music())
  h.advance(0.25)
  h.transport.pause()
  // A largada deixa 10 ms para Tone.js preparar o primeiro ataque.
  assert.equal(Math.round(h.transport.tick()), 230)
  assert.equal(h.states.at(-1).status, "paused")
  await h.transport.resume()
  h.advance(0.01)
  const piano = h.calls.filter((call) => call[0] === "note" && call[1] === "p")
  assert.equal(piano.length, 2)
  assert.ok(piano[1][3] < piano[0][3])
  h.transport.stop()
  assert.equal(h.transport.tick(), 0)
  assert.equal(h.states.at(-1).status, "stopped")
  h.transport.dispose()
})

// Sem loop o relógio deve terminar; isolamento não obedece ao solo de outra faixa.
test("termina reprodução única e aceita audição isolada", async () => {
  const h = harness()
  h.transport.setLoopEnabled(false)
  h.transport.isolateTrack("s")
  await h.transport.play(music())
  h.advance(0.02)
  assert.deepEqual(h.calls.filter((call) => call[0] === "note").map((call) => call[1]), ["s"])
  h.advance(1.2)
  assert.equal(h.states.at(-1).status, "stopped")
  h.transport.dispose()
})

// Uma composição sem eventos não deve deixar o usuário olhando uma agulha muda.
test("não inicia se não houver eventos audíveis", async () => {
  const h = harness()
  const source = music()
  source.tracks.forEach((track) => { track.mute = true })
  await h.transport.play(source)
  assert.equal(h.calls.some((call) => call[0] === "start"), false)
  assert.equal(h.states.at(-1).status, "error")
  h.transport.dispose()
})

// Uma fonte ausente não impede a outra, e resposta tardia não reativa o player.
test("isola falha de fonte e descarta carregamento obsoleto", async () => {
  const h = harness({ failTrack: "s" })
  await h.transport.play(music())
  h.advance(0.01)
  assert.deepEqual(h.calls.filter((call) => call[0] === "note").map((call) => call[1]), ["p"])
  assert.deepEqual(Array.from(h.states.at(-1).unavailableTrackIds), ["s"])
  h.transport.dispose()

  const late = harness({ delayedTrack: "p" })
  const loading = late.transport.play(music())
  late.transport.dispose()
  late.loads.get("p")()
  await loading
  assert.equal(late.calls.some((call) => call[0] === "start"), false)
})
