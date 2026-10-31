import assert from "node:assert/strict"
import test from "node:test"
import {
  addTrack, moveTrack, removeTrack, updateTrack,
  addRegion, moveRegion, resizeRegion, removeRegion,
  measureTicks, timelineTicks, setLoopRange
} from "../../app/javascript/composition/timeline_state.js"

// Usa um documento realista, com IDs estáveis e nota relativa à região.
function document() {
  return { version: 1, id: "song-1", name: "Ideia", bpm: 120,
    time_signature: { numerator: 4, denominator: 4 }, tracks: [
      { id: "track-1", name: "Melodia", instrument_id: "piano", volume: 1, mute: false, solo: false,
        regions: [{ id: "region-1", start_tick: 0, duration_ticks: 1920, notes: [
          { id: "note-1", pitch: 60, onset_tick: 480, duration_ticks: 480, velocity: 100 }
        ] }] }
    ] }
}

// Criar e ordenar faixas não deve modificar a versão anterior do documento.
test("adiciona, edita, reordena e remove faixas sem mutar a entrada", () => {
  const original = document()
  const second = addTrack(original, { id: "track-2", name: "Baixo", instrument_id: "strings" })
  const edited = updateTrack(second, "track-2", { volume: 0.5, mute: true, solo: true, name: "Baixo elétrico" })
  const reordered = moveTrack(edited, "track-2", -1)
  const removed = removeTrack(reordered, "track-1")

  assert.deepEqual(original.tracks.map((track) => track.id), ["track-1"])
  assert.deepEqual(reordered.tracks.map((track) => track.id), ["track-2", "track-1"])
  assert.equal(edited.tracks[1].instrument_id, "strings")
  assert.equal(edited.tracks[1].volume, 0.5)
  assert.equal(edited.tracks[1].mute, true)
  assert.equal(edited.tracks[1].solo, true)
  assert.deepEqual(removed.tracks.map((track) => track.id), ["track-2"])
})

// O snap atua sobre ticks, preservando as notas com tempos locais.
test("cria, move e remove regiao com snap sem alterar notas", () => {
  const original = document()
  const added = addRegion(original, "track-1", { id: "region-2", start_tick: 1920, duration_ticks: 1920, notes: [] })
  const moved = moveRegion(added, "track-1", "region-1", 700)
  const removed = removeRegion(moved, "track-1", "region-2")

  assert.equal(moved.tracks[0].regions[0].start_tick, 480)
  assert.equal(moved.tracks[0].regions[0].notes[0].onset_tick, 480)
  assert.deepEqual(removed.tracks[0].regions.map((region) => region.id), ["region-1"])
  assert.equal(original.tracks[0].regions[0].start_tick, 0)
})

// Encurtar uma região não deve apagar ou cortar eventos MIDI nela contidos.
test("redimensiona ate a ultima nota e impede duracao nula", () => {
  const original = document()
  const resized = resizeRegion(original, "track-1", "region-1", 240)

  assert.equal(resized.tracks[0].regions[0].duration_ticks, 960)
  assert.equal(resized.tracks[0].regions[0].notes[0].pitch, 60)
  assert.equal(original.tracks[0].regions[0].duration_ticks, 1920)
})

// Um compasso 6/8 usa seis colcheias de 240 ticks, sem mudar a semínima.
test("calcula compasso e tamanho visivel para 6 por 8", () => {
  const music = document()
  music.time_signature = { numerator: 6, denominator: 8 }
  assert.equal(measureTicks(music), 1440)
  assert.equal(timelineTicks(music), 5760)
})

// IDs ausentes não podem criar edições silenciosas em outra faixa ou região.
test("rejeita identificadores desconhecidos", () => {
  assert.throws(() => updateTrack(document(), "missing", { name: "Outra" }), /faixa/i)
  assert.throws(() => moveRegion(document(), "track-1", "missing", 0), /região/i)
})

// Marcadores são ticks musicais salvos e ampliam a régua sem alterar regiões.
test("ajusta marcadores com snap em 6 por 8 e preserva a entrada", () => {
  const original = document()
  original.time_signature = { numerator: 6, denominator: 8 }
  const changed = setLoopRange(original, 260, 6000)
  assert.deepEqual(changed.loop, { start_tick: 240, end_tick: 6000 })
  assert.equal(original.loop, undefined)
  assert.ok(timelineTicks(changed) >= 6000)
  changed.time_signature = { numerator: 4, denominator: 4 }
  assert.deepEqual(changed.loop, { start_tick: 240, end_tick: 6000 })
  assert.throws(() => setLoopRange(original, 480, 240), /loop|fim|marcador/i)
})
