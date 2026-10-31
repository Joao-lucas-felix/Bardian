import assert from "node:assert/strict"
import test from "node:test"
import { appendChords, removeLastChord } from "../../app/javascript/composition/harmony_draft.js"
import * as draft from "../../app/javascript/composition/harmony_draft.js"

/** Reproduz o documento versão 1 que a rota entrega à sessão no navegador. */
function emptyDraft() {
  return { version: 1, id: "draft", name: "Harmonia guiada", bpm: 120,
    time_signature: { numerator: 4, denominator: 4 }, context: { tonic: "C", mode: "major" },
    tracks: [{ id: "harmony", name: "Harmonia", instrument_id: "piano", volume: 1,
      mute: false, solo: false, regions: [{ id: "region", start_tick: 0, duration_ticks: 480, notes: [] }] }] }
}

/** Usa valores recebidos do domínio, sem calcular acordes neste teste. */
function chord(onset_tick) {
  return { degree: "I", pitches: [60, 64, 67], onset_tick }
}

/** Gera identidades observáveis para detectar duplicação entre acordes. */
function ids() {
  let serial = 0
  return () => `note-${++serial}`
}

test("redimensiona e reordena duracoes distintas sem perder identidades", () => {
  const input = appendChords(emptyDraft(), [chord(0), chord(480)], ids())
  assert.equal(typeof draft.resizeChord, "function")
  const resized = draft.resizeChord(input, 0, 1920)
  assert.equal(resized.tracks[0].regions[0].notes[3].onset_tick, 1920)
  assert.equal(resized.tracks[0].regions[0].duration_ticks, 2400)
  const moved = draft.moveChord(resized, 0, 1)
  assert.equal(moved.tracks[0].regions[0].notes[3].duration_ticks, 1920)
  assert.equal(moved.tracks[0].regions[0].notes[3].onset_tick, 480)
  const short = draft.resizeChord(moved, 0, 240)
  assert.equal(short.tracks[0].regions[0].notes[3].onset_tick, 240)
  assert.equal(short.tracks[0].regions[0].duration_ticks, 2160)
  assert.equal(draft.removeChord(short, 0).tracks[0].regions[0].duration_ticks, 1920)
  assert.equal(input.tracks[0].regions[0].duration_ticks, 960)
  assert.throws(() => draft.resizeChord(input, 0, 481), /duração/i)
  assert.throws(() => draft.resizeChord(input, 0, 0), /duração/i)
})

test("reordena acordes preservando identidade intensidade e alturas", () => {
  const input = appendChords(emptyDraft(), [chord(0), { pitches: [67, 71, 74], onset_tick: 480 }, chord(960)], ids())
  const original = structuredClone(input)
  assert.equal(typeof draft.moveChord, "function")
  const moved = draft.moveChord(input, 0, 2)
  const before = input.tracks[0].regions[0].notes
  const after = moved.tracks[0].regions[0].notes
  assert.deepEqual(after.map(n => n.id), [...before.slice(3), ...before.slice(0, 3)].map(n => n.id))
  assert.deepEqual(after.map(n => n.onset_tick), [0, 0, 0, 480, 480, 480, 960, 960, 960])
  for (const note of after) {
    const previous = before.find(n => n.id === note.id)
    assert.equal(note.pitch, previous.pitch)
    assert.equal(note.velocity, previous.velocity)
    assert.equal(note.duration_ticks, previous.duration_ticks)
  }
  assert.deepEqual(input, original)
  assert.deepEqual(draft.moveChord(moved, 2, 0), input)
  assert.throws(() => draft.moveChord(input, 0, 3), /posição/i)
  assert.throws(() => draft.moveChord(input, -1, 0), /posição/i)
})

test("remove acorde selecionado fechando o espaco na timeline", () => {
  const input = appendChords(emptyDraft(), [chord(0), chord(480), chord(960)], ids())
  assert.equal(typeof draft.removeChord, "function")
  const next = draft.removeChord(input, 1)
  assert.equal(next.tracks[0].regions[0].duration_ticks, 960)
  assert.deepEqual(next.tracks[0].regions[0].notes.slice(3).map(n => n.id), input.tracks[0].regions[0].notes.slice(6).map(n => n.id))
  assert.deepEqual(next.tracks[0].regions[0].notes.map(n => n.onset_tick), [0, 0, 0, 480, 480, 480])
})

test("adiciona tres eventos por batida sem alterar o rascunho de entrada", () => {
  const input = emptyDraft()
  const before = structuredClone(input)
  const next = appendChords(input, [chord(0)], ids())

  assert.deepEqual(next.tracks[0].regions[0].notes.map((note) => note.onset_tick), [0, 0, 0])
  assert.deepEqual(next.tracks[0].regions[0].notes.map((note) => note.pitch), [60, 64, 67])
  assert.deepEqual(input, before)
  assert.equal(next.tracks[0].regions[0].duration_ticks, 480)
})

test("quinto acorde inicia o segundo compasso e remover conserva os quatro anteriores", () => {
  const options = [0, 480, 960, 1440, 1920].map(chord)
  const five = appendChords(emptyDraft(), options, ids())
  const notes = five.tracks[0].regions[0].notes
  assert.equal(notes[12].onset_tick, 1920)
  assert.equal(new Set(notes.map((note) => note.id)).size, 15)

  const four = removeLastChord(five)
  assert.equal(four.tracks[0].regions[0].notes.length, 12)
  assert.equal(four.tracks[0].regions[0].duration_ticks, 1920)
  assert.equal(five.tracks[0].regions[0].notes.length, 15)
})

test("rejeita posicao incorreta pitch invalido e extrapolacao de oito compassos", () => {
  assert.throws(() => appendChords(emptyDraft(), [chord(480)], ids()), /tempo|posição/i)
  assert.throws(() => appendChords(emptyDraft(), [{ pitches: [60, 64, 128], onset_tick: 0 }], ids()), /pitch/i)
  const full = appendChords(emptyDraft(), Array.from({ length: 32 }, (_, index) => chord(index * 480)), ids())
  assert.throws(() => appendChords(full, [chord(15_360)], ids()), /limite/i)
})

/** Declaração com nota interna tardia detecta transferência involuntária entre blocos. */
function declaredDraft() {
  const doc = emptyDraft()
  doc.tracks[0].id = "harmony-draft"
  doc.harmony = { blocks: [
    { id: "a", onset_tick: 0, duration_ticks: 960, chord: { root: "C", quality: "major" } },
    { id: "b", onset_tick: 960, duration_ticks: 480, chord: { root: "G", quality: "major" } }
  ] }
  doc.tracks[0].regions[0].duration_ticks = 1440
  doc.tracks[0].regions[0].notes = [{ id: "late", pitch: 60, onset_tick: 720, duration_ticks: 600, velocity: 90 }]
  return doc
}

/** Reproduz uma realização com nota sustentada, ornamento, cauda e camada adicional. */
test("redimensionamento proporcional preserva desenho musical e camada adicional", () => {
  const doc = declaredDraft()
  doc.tracks[0].regions[0].notes = [
    { id: "edge", pitch: 60, onset_tick: 0, duration_ticks: 960, velocity: 90 },
    { id: "short", pitch: 64, onset_tick: 240, duration_ticks: 240, velocity: 80 },
    { id: "tail", pitch: 67, onset_tick: 0, duration_ticks: 1200, velocity: 70 },
    { id: "next", pitch: 67, onset_tick: 960, duration_ticks: 480, velocity: 90 }
  ]
  doc.tracks.push({ ...structuredClone(doc.tracks[0]), id: "harmony-extra-draft", regions: [
    { id: "extra-region", start_tick: 0, duration_ticks: 1440, notes: [
      { id: "extra", pitch: 48, onset_tick: 1000, duration_ticks: 240, velocity: 60 }
    ] }
  ] })

  const longer = draft.resizeChord(doc, "a", 1920)
  const notes = longer.tracks[0].regions[0].notes
  assert.deepEqual(notes.map(note => [note.id, note.onset_tick, note.duration_ticks]), [
    ["edge", 0, 1920], ["short", 480, 480], ["tail", 0, 2400], ["next", 1920, 480]
  ])
  assert.deepEqual(longer.tracks[1].regions[0].notes, doc.tracks[1].regions[0].notes)
  assert.equal(doc.tracks[0].regions[0].notes[0].duration_ticks, 960)

  const shorter = draft.resizeChord(longer, "a", 480)
  assert.equal(shorter.tracks[0].regions[0].notes[0].duration_ticks, 480)
  assert.equal(shorter.tracks[0].regions[0].notes[2].duration_ticks, 600)
  assert.equal(shorter.tracks[0].regions[0].notes[1].onset_tick, 120)
  assert.equal(shorter.tracks[0].regions[0].notes[1].duration_ticks, 120)
  for (const note of notes) {
    const original = doc.tracks[0].regions[0].notes.find(item => item.id === note.id)
    assert.equal(note.pitch, original.pitch)
    assert.equal(note.velocity, original.velocity)
  }
  assert.equal(shorter.tracks[0].regions[0].notes[3].onset_tick, 480)
})

test("redução mantém nota tardia no bloco e movimento preserva sua duração", () => {
  const doc = declaredDraft(), original = structuredClone(doc)
  const reduced = draft.resizeChord(doc, "a", 480)
  assert.equal(reduced.tracks[0].regions[0].notes[0].onset_tick, 360)
  assert.equal(reduced.tracks[0].regions[0].notes[0].duration_ticks, 300)
  const moved = draft.moveChord(doc, "a", 1)
  assert.equal(moved.tracks[0].regions[0].notes[0].onset_tick, 1200)
  assert.equal(moved.tracks[0].regions[0].notes[0].duration_ticks, 600)
  assert.equal(moved.tracks[0].regions[0].duration_ticks, 1800)
  assert.deepEqual(doc, original)
  const removed = draft.removeChord(doc, "a")
  assert.equal(removed.harmony.blocks[0].id, "b")
  assert.equal(removed.harmony.blocks[0].onset_tick, 0)
  assert.equal(removed.tracks[0].regions[0].notes.length, 0)
})

test("recuperacao particiona ids exatamente uma vez", () => {
  const doc = declaredDraft(), blocks = doc.harmony.blocks
  delete doc.harmony
  assert.equal(typeof draft.applyRecovery, "function")
  const recovered = draft.applyRecovery(doc, blocks, { late: "additional" }, ids())
  assert.equal(recovered.tracks[0].regions[0].notes.length, 0)
  assert.equal(recovered.tracks[1].regions[0].notes[0].id, "late")
  assert.throws(() => draft.applyRecovery(doc, blocks, {}, ids()), /nota|partição/i)
})

/** Exercita posições relativas num bloco posterior e arredondamento no limite. */
test("reduzir bloco posterior mantém início dentro dele e duração mínima positiva", () => {
  const doc = declaredDraft()
  doc.tracks[0].regions[0].notes = [
    { id: "tiny", pitch: 62, onset_tick: 1439, duration_ticks: 1, velocity: 75 }
  ]
  const result = draft.resizeChord(doc, "b", 240)
  assert.deepEqual(result.tracks[0].regions[0].notes, [
    { id: "tiny", pitch: 62, onset_tick: 1199, duration_ticks: 1, velocity: 75 }
  ])
  assert.equal(result.harmony.blocks[1].onset_tick, 960)
  assert.equal(result.tracks[0].regions[0].duration_ticks, 1200)
})

/** Confere que uma nota editada para meio tempo acompanha todas as opções do seletor. */
test("nota editada no piano roll acompanha bloco de um tempo até a reprodução", async () => {
  const { applyEditorNotes, editorState } = await import("./helpers/harmony_editor.mjs")
  const { mapHarmonyDocument } = await import("../../app/javascript/composition/opendaw_mapping.js")
  const doc = declaredDraft()
  doc.harmony.blocks = [{ ...doc.harmony.blocks[0], duration_ticks: 480 }]
  doc.tracks[0].instrument_id = "synth"
  doc.tracks[0].regions[0].notes = []
  const edited = applyEditorNotes(doc, [{ id: "edited", pitch: 62, onset: 120, duration: 240, velocity: 75 }])
  const original = structuredClone(edited)
  for (const [duration, onset, length] of [[240, 60, 120], [480, 120, 240], [960, 240, 480], [1920, 480, 960]]) {
    const result = draft.resizeChord(edited, "a", duration)
    assert.deepEqual(editorState(result).notes, [{ id: "edited", pitch: 62, onset, duration: length, velocity: 75 }])
    const event = mapHarmonyDocument(result).tracks[0].regions[0].notes[0]
    assert.equal(event.position, onset * 2)
    assert.equal(event.duration, length * 2)
    assert.deepEqual(draft.resizeChord(result, "a", 480), original)
  }
  assert.deepEqual(edited, original)
})
