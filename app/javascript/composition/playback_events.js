/** Lê o documento musical sem depender da interface ou de Tone.js. */

/**
 * Devolve o último tick ocupado por uma região, inclusive regiões sem notas.
 * @param {object} music Documento musical versionado.
 * @returns {number} Fim absoluto, ou zero em um arranjo vazio.
 */
export function arrangementEndTick(music) {
  return music.tracks.reduce((end, track) => track.regions.reduce((last, region) =>
    Math.max(last, region.start_tick + region.duration_ticks), end), 0)
}

/**
 * Obtém marcadores explícitos ou calcula o trecho automático do arranjo.
 * @param {object} music Documento musical versionado.
 * @returns {{startTick:number,endTick:number,explicit:boolean}} Intervalo em ticks.
 */
export function loopRange(music) {
  if (music.loop) return { startTick: music.loop.start_tick, endTick: music.loop.end_tick, explicit: true }
  const measureTicks = 480 * 4 / music.time_signature.denominator * music.time_signature.numerator
  return { startTick: 0, endTick: arrangementEndTick(music) || measureTicks * 4, explicit: false }
}

/**
 * Seleciona faixas para a mixagem; mute prevalece sobre solo e isolamento.
 * @param {object} music Documento musical versionado.
 * @param {string|null} isolatedTrackId Faixa única solicitada, se houver.
 * @returns {string[]} IDs audíveis na ordem das faixas.
 */
export function audibleTrackIds(music, isolatedTrackId = null) {
  if (isolatedTrackId !== null) return music.tracks.filter((track) => track.id === isolatedTrackId && !track.mute).map((track) => track.id)
  const anySolo = music.tracks.some((track) => track.solo)
  return music.tracks.filter((track) => !track.mute && (!anySolo || track.solo)).map((track) => track.id)
}

/**
 * Extrai as partes audíveis das notas na janela absoluta [início, fim).
 * @param {object} music Documento musical versionado.
 * @param {number} startTick Início absoluto inclusivo.
 * @param {number} endTick Fim absoluto exclusivo.
 * @param {string|null} isolatedTrackId Faixa única solicitada, se houver.
 * @returns {Array<object>} Eventos ordenados por início absoluto, sem alterar o documento.
 */
export function eventsInRange(music, startTick, endTick, isolatedTrackId = null) {
  if (endTick <= startTick) return []
  const allowed = new Set(audibleTrackIds(music, isolatedTrackId))
  const events = []
  for (const track of music.tracks) {
    if (!allowed.has(track.id)) continue
    for (const region of track.regions) {
      for (const note of region.notes) {
        const noteStart = region.start_tick + note.onset_tick
        const noteEnd = noteStart + note.duration_ticks
        const onsetTick = Math.max(noteStart, startTick)
        const end = Math.min(noteEnd, endTick)
        if (end <= onsetTick) continue
        events.push({ id: note.id, trackId: track.id, instrumentId: track.instrument_id,
          pitch: note.pitch, velocity: note.velocity, onsetTick, durationTicks: end - onsetTick })
      }
    }
  }
  return events.sort((left, right) => left.onsetTick - right.onsetTick)
}

/**
 * Converte uma unidade de tick em segundos sem mudar a posição musical.
 * @param {number} bpm Andamento positivo em semínimas por minuto.
 * @returns {number} Duração de um tick no relógio do áudio.
 */
export function secondsPerTick(bpm) {
  if (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm <= 0) throw new Error("BPM inválido")
  return 60 / (bpm * 480)
}
