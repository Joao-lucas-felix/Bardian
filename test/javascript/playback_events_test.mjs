import assert from "node:assert/strict"
import test from "node:test"
import { arrangementEndTick, loopRange, audibleTrackIds, eventsInRange, secondsPerTick } from "../../app/javascript/composition/playback_events.js"

/** Monta duas faixas simultâneas sem depender de Canvas ou Tone.js. */
function music() {
  return { version: 1, id: "song", name: "Ideia", bpm: 120,
    time_signature: { numerator: 4, denominator: 4 }, tracks: [
      { id: "piano", name: "Piano", instrument_id: "piano", volume: 1, mute: false, solo: false,
        regions: [{ id: "r1", start_tick: 480, duration_ticks: 1920, notes: [
          { id: "n1", pitch: 60, onset_tick: 120, duration_ticks: 480, velocity: 100 },
          { id: "n2", pitch: 64, onset_tick: 480, duration_ticks: 480, velocity: 90 }
        ] }] },
      { id: "strings", name: "Cordas", instrument_id: "strings", volume: 0.8, mute: false, solo: false,
        regions: [{ id: "r2", start_tick: 0, duration_ticks: 1920, notes: [
          { id: "n3", pitch: 72, onset_tick: 600, duration_ticks: 960, velocity: 127 }
        ] }] }
    ] }
}

// Início local da nota deve ser somado ao início absoluto de sua região.
test("extrai eventos absolutos simultâneos e converte ticks para segundos", () => {
  const source = music()
  const events = eventsInRange(source, 0, 2400)
  assert.deepEqual(events.map((event) => [event.id, event.trackId, event.onsetTick, event.durationTicks]), [
    ["n1", "piano", 600, 480], ["n3", "strings", 600, 960], ["n2", "piano", 960, 480]
  ])
  assert.equal(events[0].velocity, 100)
  assert.equal(events[1].instrumentId, "strings")
  assert.equal(secondsPerTick(120) * 480, 0.5)
  assert.equal(arrangementEndTick(source), 2400)
  assert.deepEqual(loopRange(source), { startTick: 0, endTick: 2400, explicit: false })
  assert.equal(source.tracks[0].regions[0].notes[0].onset_tick, 120)
})

// O limite esquerdo reaproveita a cauda; o direito não deixa uma nota atacar duas vezes.
test("recorta notas nas bordas do loop sem duplicar ataques", () => {
  const source = music()
  source.loop = { start_tick: 720, end_tick: 1200 }
  const events = eventsInRange(source, 720, 1200)
  assert.deepEqual(events.map((event) => [event.id, event.onsetTick, event.durationTicks]), [
    ["n1", 720, 360], ["n3", 720, 480], ["n2", 960, 240]
  ])
  assert.deepEqual(loopRange(source), { startTick: 720, endTick: 1200, explicit: true })
  assert.equal(eventsInRange(source, 1200, 1200).length, 0)
})

// Solo só permite as faixas escolhidas; mute e audição isolada têm precedência clara.
test("seleciona faixas audíveis respeitando solo mute e isolamento", () => {
  const source = music()
  source.tracks[1].solo = true
  assert.deepEqual(audibleTrackIds(source), ["strings"])
  source.tracks[1].mute = true
  assert.deepEqual(audibleTrackIds(source), [])
  assert.deepEqual(audibleTrackIds(source, "piano"), ["piano"])
  assert.deepEqual(audibleTrackIds(source, "strings"), [])
  assert.deepEqual(eventsInRange(source, 0, 2400, "strings"), [])
  assert.deepEqual(audibleTrackIds(source, "missing"), [])
})

// O intervalo automático acompanha a composição; silêncio explícito ainda é tempo musical.
test("fim automático acompanha regiões enquanto loop explícito admite silêncio", () => {
  const source = music()
  source.tracks[0].regions = []
  assert.equal(arrangementEndTick(source), 1920)
  assert.deepEqual(loopRange(source), { startTick: 0, endTick: 1920, explicit: false })
  source.loop = { start_tick: 0, end_tick: 3840 }
  assert.deepEqual(loopRange(source), { startTick: 0, endTick: 3840, explicit: true })
  assert.equal(eventsInRange(source, 2400, 3840).length, 0)
})
