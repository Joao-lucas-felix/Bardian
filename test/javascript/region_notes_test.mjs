import assert from "node:assert/strict"
import test from "node:test"
import { regionFor, toEditorNotes, replaceRegionNotes, newNoteId, addSuggestedChord } from "../../app/javascript/composition/region_notes.js"

// A sugestão é uma leitura até a ação explícita; aplicar preserva e não duplica.
test("aplicacao explicita acrescenta apenas alturas ausentes no mesmo inicio", () => {
  const music = composition()
  const before = structuredClone(music)
  const suggestion = { pitches: [60, 64, 67], onset: 480, duration: 480 }
  assert.deepEqual(music, before)
  let serial = 0
  const applied = addSuggestedChord(music, "track-1", "region-1", suggestion, () => `new-note-${++serial}`)
  assert.deepEqual(music, before)
  assert.deepEqual(applied.tracks[0].regions[0].notes.map((note) => note.pitch), [60, 64, 67])
  assert.equal(applied.tracks[0].regions[0].notes[0].id, "note-1")
})

// Uma composição realista permite testar isolamento de faixas e IDs globais.
function composition() {
  return { version: 1, id: "song-1", name: "Ideia", bpm: 120,
    time_signature: { numerator: 4, denominator: 4 }, tracks: [
      { id: "track-1", name: "Melodia", instrument_id: "piano", volume: 1, mute: false, solo: false,
        regions: [{ id: "region-1", start_tick: 960, duration_ticks: 1920, notes: [
          { id: "note-1", pitch: 60, onset_tick: 480, duration_ticks: 480, velocity: 90 }
        ] }] },
      { id: "track-2", name: "Baixo", instrument_id: "strings", volume: 1, mute: false, solo: false,
        regions: [{ id: "region-2", start_tick: 0, duration_ticks: 1920, notes: [
          { id: "note-2", pitch: 48, onset_tick: 0, duration_ticks: 960, velocity: 100 }
        ] }] }
    ] }
}

// O início da nota é relativo à região, não à composição.
test("converte notas da regiao sem somar seu inicio absoluto", () => {
  const music = composition()
  const editorNotes = toEditorNotes(regionFor(music, "track-1", "region-1"))
  assert.deepEqual(editorNotes, [{ id: "note-1", pitch: 60, onset: 480, duration: 480, velocity: 90 }])
  editorNotes[0].pitch = 72
  assert.equal(music.tracks[0].regions[0].notes[0].pitch, 60)
  assert.throws(() => regionFor(music, "track-2", "region-1"), /região/i)
})

// Edição de uma região não substitui notas de outra faixa nem altera a entrada.
test("substitui so as notas da regiao ativa", () => {
  const music = composition()
  const next = replaceRegionNotes(music, "track-1", "region-1", [
    { id: "note-1", pitch: 72, onset: 480, duration: 240, velocity: 110 }
  ])
  assert.equal(next.tracks[0].regions[0].notes[0].onset_tick, 480)
  assert.equal(next.tracks[0].regions[0].notes[0].duration_ticks, 240)
  assert.equal(next.tracks[1].regions[0].notes[0].pitch, 48)
  assert.equal(music.tracks[0].regions[0].notes[0].pitch, 60)
})

// Os limites MIDI e a duração protegem o contrato validado no servidor.
test("rejeita notas invalidas antes de tocar no documento", () => {
  const music = composition()
  const valid = { id: "new-note", pitch: 60, onset: 0, duration: 480, velocity: 90 }
  for (const change of [
    { pitch: 128 }, { velocity: 0 }, { onset: 1800, duration: 240 },
    { duration: 0 }, { onset: -1 }, { id: "note-2" }, { id: "region-2" }
  ]) {
    assert.throws(() => replaceRegionNotes(music, "track-1", "region-1", [{ ...valid, ...change }]), /inválid|excede|repetid/i)
  }
  assert.equal(music.tracks[0].regions[0].notes[0].pitch, 60)
})

// Pitches fora da janela antiga não podem desaparecer ao abrir o editor.
test("nao filtra pitches MIDI validos da regiao", () => {
  const region = regionFor(composition(), "track-1", "region-1")
  region.notes.push({ id: "extra", pitch: 127, onset_tick: 0, duration_ticks: 480, velocity: 1 })
  assert.equal(toEditorNotes(region)[1].pitch, 127)
})

// O gerador cobre todas as identidades da árvore e falha após tentativas finitas.
test("gera identificador globalmente unico", () => {
  const music = composition()
  const candidates = ["note-2", "fresh-id"]
  assert.equal(newNoteId(music, () => candidates.shift()), "fresh-id")
  assert.throws(() => newNoteId(music, () => "note-1"), /ID|identificador/i)
})
