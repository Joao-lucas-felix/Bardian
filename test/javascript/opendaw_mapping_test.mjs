import assert from "node:assert/strict"
import test from "node:test"
import { mapHarmonyDocument } from "../../app/javascript/composition/opendaw_mapping.js"

/** Documento do contrato real: tríade, durações diferentes e ganho linear. */
const document = { bpm: 96, tracks: [{ name: "Harmonia", instrument_id: "synth", volume: 0.7, mute: false, solo: true,
  regions: [{ start_tick: 480, duration_ticks: 960, notes: [60, 64, 67].map((pitch, i) => ({ pitch, onset_tick: 0, duration_ticks: i ? 480 : 960, velocity: 90 })) }] }] }

test("preserva bpm alturas ganho flags e converte ticks sem mutar documento", () => {
  const before = structuredClone(document)
  const result = mapHarmonyDocument(document)
  assert.deepEqual(document, before)
  assert.equal(result.bpm, 96)
  assert.equal(result.end, 2880)
  assert.equal(result.tracks[0].regions[0].position, 960)
  assert.deepEqual(result.tracks[0].regions[0].notes.map(n => n.duration), [1920, 960, 960])
  assert.equal(result.tracks[0].regions[0].notes[0].velocity, 90 / 127)
  assert.equal(result.tracks[0].solo, true)
  assert.equal(result.tracks[0].volumeDb, 20 * Math.log10(0.7))
})

test("recusa timbre sem mapeamento e notas invalidas", () => {
  const invalid = structuredClone(document)
  invalid.tracks[0].instrument_id = "piano"
  assert.throws(() => mapHarmonyDocument(invalid), /Instrumento/)
  invalid.tracks[0].instrument_id = "synth"
  invalid.tracks[0].regions[0].notes[0].duration_ticks = 0
  assert.throws(() => mapHarmonyDocument(invalid), /Nota/)
  invalid.tracks[0].regions[0].notes = []
  assert.throws(() => mapHarmonyDocument(invalid), /Adicione/)
})

test("transmite id permitido pelo catalogo sem mudar as notas", () => {
  const changed = structuredClone(document)
  changed.tracks[0].instrument_id = "harmony_pad"
  const mapped = mapHarmonyDocument(changed, 960, ["synth", "harmony_pad"])
  assert.equal(mapped.tracks[0].instrumentId, "harmony_pad")
  assert.deepEqual(mapped.tracks[0].regions, mapHarmonyDocument(document).tracks[0].regions)
})

test("duas faixas e blocos silenciosos definem fim sem padding", () => {
  const doc = structuredClone(document)
  doc.harmony = { blocks: [{ onset_tick: 0, duration_ticks: 1920 }] }
  doc.tracks.push({ ...structuredClone(doc.tracks[0]), name: "Adicionais" })
  doc.tracks[1].regions[0].notes = []
  assert.equal(mapHarmonyDocument(doc, 480).end, 1920)
  doc.tracks[0].regions[0].notes[0].velocity = 0
  assert.throws(() => mapHarmonyDocument(doc), /Nota/)
})
