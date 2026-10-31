import test from "node:test"
import assert from "node:assert/strict"

// O histórico restaura também declaração e camadas; notas isoladas não bastam.
test("undo restaura documento integral e nova edicao abandona redo", async () => {
  const history = await import("../../app/javascript/composition/harmony_history.js")
  const before = { harmony: { blocks: [] }, tracks: [] }
  const after = { harmony: { blocks: [{ id: "a" }] }, tracks: [{ id: "extra" }] }
  const recorded = history.record(history.createHistory(before), after)
  const back = history.undo(recorded)
  assert.deepEqual(back.document, before)
  assert.deepEqual(history.redo(back.history).document, after)
  assert.equal(history.redo(history.record(back.history, { ...before, bpm: 90 })).changed, false)
})
