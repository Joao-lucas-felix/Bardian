import assert from "node:assert/strict"
import test from "node:test"
import { createHistory, record, redo, undo } from "../../app/javascript/composition/note_history.js"

// Os snapshots representam operações confirmadas, não movimentos intermediários do ponteiro.
const initial = [{ id: "a", pitch: 60, onset: 0, duration: 480, velocity: 100 }]
const edited = [{ id: "a", pitch: 62, onset: 0, duration: 480, velocity: 127 }]

test("desfaz e refaz notas completas sem compartilhar referências", () => {
  const first = createHistory(initial)
  const second = record(first, edited)
  const undone = undo(second)
  assert.deepEqual(undone.notes, initial)
  assert.equal(undone.changed, true)
  assert.deepEqual(redo(undone.history).notes, edited)
  initial[0].pitch = 99
  edited[0].velocity = 1
  assert.equal(second.snapshots[0][0].pitch, 60)
  assert.equal(second.snapshots[1][0].velocity, 127)
})

test("sem passo disponível, mantém estado e informa changed false", () => {
  const history = createHistory([])
  assert.equal(undo(history).changed, false)
  assert.equal(redo(history).changed, false)
  assert.deepEqual(undo(history).notes, [])
})

test("nova operação após desfazer descarta apenas o ramo futuro", () => {
  const first = createHistory([])
  const second = record(first, [{ id: "b", pitch: 50, onset: 0, duration: 120, velocity: 80 }])
  const third = record(undo(second).history, [{ id: "c", pitch: 51, onset: 0, duration: 120, velocity: 81 }])
  assert.equal(redo(third).changed, false)
  assert.equal(third.snapshots.length, 2)
  assert.equal(first.snapshots.length, 1)
})

test("históricos de duas regiões permanecem independentes", () => {
  const regionA = record(createHistory([]), [{ id: "a", pitch: 60, onset: 0, duration: 480, velocity: 100 }])
  const regionB = createHistory([{ id: "b", pitch: 40, onset: 0, duration: 480, velocity: 90 }])
  assert.deepEqual(undo(regionA).notes, [])
  assert.equal(regionB.snapshots[0][0].id, "b")
})
