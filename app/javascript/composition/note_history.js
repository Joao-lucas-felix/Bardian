/** Copia notas MIDI para impedir que edições futuras alterem pontos do histórico. */
function copyNotes(notes) {
  return notes.map(({ id, pitch, onset, duration, velocity }) => ({ id, pitch, onset, duration, velocity }))
}

/** Inicia o histórico de uma região com seu estado atual como ponto de partida. */
export function createHistory(initialNotes) {
  return { snapshots: [copyNotes(initialNotes)], index: 0 }
}

/** Registra uma operação confirmada e abandona o ramo de refazer, se houver. */
export function record(history, notes) {
  const snapshot = copyNotes(notes)
  if (JSON.stringify(history.snapshots[history.index]) === JSON.stringify(snapshot)) return history
  return { snapshots: [...history.snapshots.slice(0, history.index + 1), snapshot], index: history.index + 1 }
}

/** Reposiciona o histórico um passo atrás, sem modificar os snapshots existentes. */
export function undo(history) {
  const changed = history.index > 0
  const index = changed ? history.index - 1 : history.index
  return { history: { snapshots: history.snapshots, index }, notes: copyNotes(history.snapshots[index]), changed }
}

/** Reposiciona o histórico um passo à frente quando há operação para refazer. */
export function redo(history) {
  const changed = history.index < history.snapshots.length - 1
  const index = changed ? history.index + 1 : history.index
  return { history: { snapshots: history.snapshots, index }, notes: copyNotes(history.snapshots[index]), changed }
}
