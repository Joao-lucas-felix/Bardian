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
      calls.push(["load", track.id, track.instrument_id])
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

// Evento já preparado à frente precisa ser substituído sem ataque fantasma.
test("edição futura cancela agendamento antigo e toca a versão nova", async () => {
  const h = harness()
  const original = music()
  original.tracks[1].mute = true
  original.tracks[0].regions[0].notes[0].onset_tick = 120
  original.tracks[0].regions[0].notes[0].duration_ticks = 480
  await h.transport.play(original)
  const edited = structuredClone(original)
  edited.tracks[0].regions[0].notes[0].pitch = 65
  edited.tracks[0].regions[0].notes[0].onset_tick = 240
  h.transport.update(edited)
  h.advance(0.16)
  assert.equal(h.calls.filter((call) => call[0] === "note").length, 0)
  h.advance(0.12)
  assert.deepEqual(h.calls.filter((call) => call[0] === "note").map((call) => call[2]), [65])
  assert.equal(h.calls.filter((call) => call[0] === "stop").length, 1)
  h.transport.dispose()
})

// Nota editada após seu ataque espera a próxima volta e não corta a voz atual.
test("edição atrás da agulha só aparece no ciclo seguinte", async () => {
  const h = harness()
  const original = music()
  original.tracks[1].mute = true
  await h.transport.play(original)
  h.advance(0.02)
  const edited = structuredClone(original)
  edited.tracks[0].regions[0].notes[0].pitch = 67
  h.transport.update(edited)
  h.advance(0.5)
  assert.deepEqual(h.calls.filter((call) => call[0] === "note").map((call) => call[2]), [60])
  h.advance(0.5)
  assert.deepEqual(h.calls.filter((call) => call[0] === "note").map((call) => call[2]), [60, 67])
  assert.equal(h.calls.some((call) => call[0] === "silence" && call[1] === "p"), false)
  h.transport.dispose()
})

// Uma nota criada num ponto já percorrido não deve soar como cauda improvisada.
test("nota nova atrás da agulha aguarda próxima passada", async () => {
  const h = harness()
  const original = music()
  original.tracks[1].mute = true
  await h.transport.play(original)
  h.advance(0.3)
  const edited = structuredClone(original)
  edited.tracks[0].regions[0].notes.push({ id: "new", pitch: 65, onset_tick: 120, duration_ticks: 480, velocity: 100 })
  h.transport.update(edited)
  h.advance(0.3)
  assert.equal(h.calls.filter((call) => call[0] === "note" && call[2] === 65).length, 0)
  h.advance(0.6)
  assert.equal(h.calls.filter((call) => call[0] === "note" && call[2] === 65).length, 1)
  h.transport.dispose()
})

// Tempo muda em segundos, nunca a posição musical da agulha.
test("mudança de BPM conserva tick e desloca somente eventos futuros", async () => {
  const h = harness()
  const original = music()
  original.tracks[1].mute = true
  original.tracks[0].regions[0].notes[0].onset_tick = 480
  original.tracks[0].regions[0].notes[0].duration_ticks = 480
  await h.transport.play(original)
  h.advance(0.26)
  const before = h.transport.tick()
  const edited = structuredClone(original)
  edited.bpm = 60
  h.transport.update(edited)
  assert.equal(h.transport.tick(), before)
  h.advance(0.3)
  assert.equal(h.calls.filter((call) => call[0] === "note").length, 0)
  h.advance(0.25)
  assert.equal(h.calls.filter((call) => call[0] === "note").length, 1)
  h.transport.dispose()
})

// Mute e volume atuam sobre faixas ativas, sem parar o relógio global.
test("aplica mute solo volume e isolamento durante a reprodução", async () => {
  const h = harness()
  const original = music()
  await h.transport.play(original)
  h.advance(0.02)
  const edited = structuredClone(original)
  edited.tracks[0].volume = 0.2
  edited.tracks[1].solo = true
  edited.tracks[1].mute = true
  h.transport.update(edited)
  assert.ok(h.calls.some((call) => call[0] === "silence" && call[1] === "p"))
  assert.ok(h.calls.some((call) => call[0] === "silence" && call[1] === "s"))
  h.transport.isolateTrack("p")
  assert.ok(h.calls.some((call) => call[0] === "volume" && call[1] === "p" && call[2] === 0.2))
  assert.equal(h.states.at(-1).status, "playing")
  h.transport.dispose()
})

// Mudar o intervalo não teleporta a agulha; a próxima volta usa marcadores novos.
test("aplica novos marcadores e alternância do loop somente no retorno", async () => {
  const h = harness()
  const original = music()
  await h.transport.play(original)
  h.advance(0.5)
  const edited = structuredClone(original)
  edited.loop = { start_tick: 240, end_tick: 720 }
  h.transport.update(edited)
  assert.ok(h.transport.tick() > 400)
  h.advance(0.52)
  assert.ok(h.transport.tick() >= 240 && h.transport.tick() < 720)
  h.transport.setLoopEnabled(false)
  h.advance(0.5)
  assert.equal(h.states.at(-1).status, "playing")
  h.advance(1.1)
  assert.equal(h.states.at(-1).status, "stopped")
  h.transport.dispose()
})

// Remover uma faixa deve liberar a fonte; trocar o timbre só recarrega aquela faixa.
test("libera faixa removida e troca instrumento sem parar a composição", async () => {
  const h = harness()
  const original = music()
  await h.transport.play(original)
  h.advance(0.02)
  const edited = structuredClone(original)
  edited.tracks = [edited.tracks[0]]
  edited.tracks[0].instrument_id = "strings"
  h.transport.update(edited)
  await Promise.resolve()
  assert.ok(h.calls.some((call) => call[0] === "disposeTrack" && call[1] === "s"))
  assert.ok(h.calls.some((call) => call[0] === "disposeTrack" && call[1] === "p"))
  assert.ok(h.calls.some((call) => call[0] === "load" && call[1] === "p" && call[2] === "strings"))
  assert.equal(h.states.at(-1).status, "playing")
  h.transport.dispose()
})

// Stop precisa devolver o relógio e liberar amostras, não só cancelar callbacks.
test("parar libera fontes carregadas das faixas", async () => {
  const h = harness()
  await h.transport.play(music())
  h.transport.stop()
  assert.deepEqual(h.calls.filter((call) => call[0] === "disposeTrack").map((call) => call[1]).sort(), ["p", "s"])
  h.transport.dispose()
})
