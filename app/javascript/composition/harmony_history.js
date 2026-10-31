/** Guarda snapshots integrais, sem incluir cursor nem recursos de áudio. */
export function createHistory(document) {
  return { snapshots: [structuredClone(document)], index: 0 }
}

/** Confirma uma operação; nova edição descarta somente o ramo de refazer. */
export function record(history, document) {
  if (JSON.stringify(history.snapshots[history.index]) === JSON.stringify(document)) return history
  return { snapshots: [...history.snapshots.slice(0, history.index + 1), structuredClone(document)], index: history.index + 1 }
}

/** Retorna cópia independente do snapshot anterior, preservando o histórico recebido. */
export function undo(history) { return restore(history, Math.max(0, history.index - 1)) }

/** Retorna cópia independente do snapshot seguinte, se disponível. */
export function redo(history) { return restore(history, Math.min(history.snapshots.length - 1, history.index + 1)) }

/** Centraliza navegação do índice sem compartilhar o documento restaurado com o histórico. */
function restore(history, index) {
  return { history: { snapshots: history.snapshots, index }, document: structuredClone(history.snapshots[index]), changed: index !== history.index }
}
