/**
 * Converte o contrato Rails de 480 ticks por semínima para PPQN do SDK.
 * O motor fornece IDs do catálogo instalado; rejeita fontes sem mapeamento.
 * @returns {object} Sessão de execução, sem alterar o documento persistido.
 */
export function mapHarmonyDocument(document, ppqn = 960, instrumentIds = ["synth"]) {
  if (!Number.isFinite(document?.bpm) || document.bpm <= 0) throw new Error("Andamento inválido")
  if (!Array.isArray(document.tracks) || !document.tracks.length || document.tracks.length > 2) throw new Error("A harmonia requer uma faixa")
  if (!Number.isFinite(ppqn) || ppqn <= 0) throw new Error("PPQN inválido")
  const ticks = (value) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Tempo inválido")
    return value * ppqn / 480
  }
  let end = Math.max(0, ...(document.harmony?.blocks || []).map(block => ticks(block.onset_tick + block.duration_ticks)))
  const tracks = document.tracks.map((track) => {
    if (!instrumentIds.includes(track.instrument_id)) throw new Error("Instrumento indisponível para esta harmonia")
    if (!Number.isFinite(track.volume) || track.volume < 0 || track.volume > 1) throw new Error("Volume inválido")
    return { name: track.name, instrumentId: track.instrument_id, volumeDb: track.volume > 0 ? 20 * Math.log10(track.volume) : -96,
      mute: track.mute || track.volume === 0, solo: track.solo,
      regions: track.regions.map((region) => {
        const position = ticks(region.start_tick)
        const duration = ticks(region.duration_ticks)
        if (!duration) throw new Error("Duração inválida")
        const notes = region.notes.map((note) => {
          if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127 ||
              !Number.isInteger(note.velocity) || note.velocity < 1 || note.velocity > 127) throw new Error("Nota inválida")
          const onset = ticks(note.onset_tick)
          const length = ticks(note.duration_ticks)
          if (!length || onset + length > duration) throw new Error("Nota fora da região")
          end = Math.max(end, position + onset + length)
          return { position: onset, duration: length, pitch: note.pitch, velocity: note.velocity / 127, chance: 100, cent: 0 }
        })
        return { position, duration, notes }
      }) }
  })
  if (!end) throw new Error("Adicione um acorde para ouvir")
  return { bpm: document.bpm, tracks, end }
}
