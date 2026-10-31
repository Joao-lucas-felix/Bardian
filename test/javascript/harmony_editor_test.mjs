import assert from "node:assert/strict"
import test from "node:test"

/** Região real de notas livres, incluindo os limites válidos do MIDI. */
const document = { id: "music", bpm: 96, time_signature: { numerator: 4, denominator: 4 },
  tracks: [{ id: "track", regions: [{ id: "region", duration_ticks: 960, notes: [
    { id: "low", pitch: 0, onset_tick: 17, duration_ticks: 113, velocity: 80 },
    { id: "high", pitch: 127, onset_tick: 240, duration_ticks: 720, velocity: 100 }
  ] }] }] }

test("ponte preserva notas livres limites midi e identidades no round trip", async () => {
  const { editorState, applyEditorNotes } = await import("./helpers/harmony_editor.mjs")
  const state = editorState(document)
  assert.equal(state.totalTicks, 960)
  assert.equal(state.bpm, 96)
  assert.equal(state.notes[0].onset, 17)
  assert.deepEqual(applyEditorNotes(document, state.notes), document)
  const changed = structuredClone(state.notes)
  changed[0].pitch = 61
  assert.equal(applyEditorNotes(document, changed).tracks[0].regions[0].notes[0].pitch, 61)
  assert.equal(document.tracks[0].regions[0].notes[0].pitch, 0)
  changed[0].duration = 999
  assert.throws(() => applyEditorNotes(document, changed), /região/)
})

test("camada adicional virtual recebe notas sem alterar realizacao", async () => {
  const { editorState, applyEditorNotes } = await import("./helpers/harmony_editor.mjs")
  const doc = structuredClone(document)
  doc.tracks[0].id = "harmony-music"
  doc.tracks[0].regions[0].notes = []
  doc.harmony = { blocks: [] }
  assert.deepEqual(editorState(doc, "additional").notes, [])
  const notes = [{ id: "extra-note", pitch: 48, onset: 2000, duration: 500, velocity: 90 }]
  const next = applyEditorNotes(doc, notes, "additional")
  assert.equal(next.tracks[1].regions[0].notes[0].onset_tick, 2000)
  assert.equal(next.tracks[0].regions[0].notes.length, 0)
  assert.throws(() => applyEditorNotes(doc, notes, "realization"), /início/)
})
