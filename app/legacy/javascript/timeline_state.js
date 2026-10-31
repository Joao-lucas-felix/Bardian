/**
 * Operações puras sobre o documento musical versionado.
 * Recebem um documento JSON e devolvem uma cópia; nenhum pixel entra no estado.
 */

/** Copia o documento para que uma interação não modifique o último estado salvo. */
function copy(music) {
  return structuredClone(music)
}

/** Retorna a quantidade de ticks de uma batida no compasso declarado. */
export function beatTicks(music) {
  return 480 * 4 / music.time_signature.denominator
}

/** Retorna a duração em ticks de um compasso completo. */
export function measureTicks(music) {
  return beatTicks(music) * music.time_signature.numerator
}

/** Mantém no mínimo quatro compassos e espaço após a última região. */
export function timelineTicks(music) {
  const lastEnd = music.tracks.reduce((max, track) =>
    Math.max(max, ...track.regions.map((region) => region.start_tick + region.duration_ticks)), 0)
  const measure = measureTicks(music)
  return Math.max(measure * 4, Math.ceil((Math.max(lastEnd, music.loop?.end_tick || 0) + measure) / measure) * measure)
}

/**
 * Guarda marcadores em ticks com snap de batida, sem modificar a composição.
 * @param {object} music Documento musical a copiar.
 * @param {number} startTick Início solicitado em ticks absolutos.
 * @param {number} endTick Fim solicitado em ticks absolutos.
 * @returns {object} Novo documento com intervalo explícito válido.
 */
export function setLoopRange(music, startTick, endTick) {
  if (!Number.isInteger(startTick) || !Number.isInteger(endTick) || startTick < 0 || endTick <= startTick) {
    throw new Error("Marcadores de loop inválidos")
  }
  const start = snapTick(music, startTick)
  const end = snapTick(music, endTick)
  if (end <= start) throw new Error("Fim do loop deve superar o início")
  const next = copy(music)
  next.loop = { start_tick: start, end_tick: end }
  return next
}

/** Arredonda uma posição à batida mais próxima e impede tempo negativo. */
export function snapTick(music, tick) {
  const beat = beatTicks(music)
  return Math.max(0, Math.round(tick / beat) * beat)
}

/** Localiza uma faixa pelo ID estável, ou informa que ela não existe. */
function trackIn(music, trackId) {
  const track = music.tracks.find((candidate) => candidate.id === trackId)
  if (!track) throw new Error("Faixa não encontrada")
  return track
}

/** Localiza uma região dentro de sua faixa, sem atingir IDs de outra faixa. */
function regionIn(track, regionId) {
  const region = track.regions.find((candidate) => candidate.id === regionId)
  if (!region) throw new Error("Região não encontrada")
  return region
}

/** Adiciona uma faixa vazia ao fim da ordem de apresentação e reprodução. */
export function addTrack(music, { id, name, instrument_id }) {
  const next = copy(music)
  if (next.tracks.some((track) => track.id === id)) throw new Error("ID de faixa repetido")
  next.tracks.push({ id, name, instrument_id, volume: 1, mute: false, solo: false, regions: [] })
  return next
}

/** Modifica apenas controles permitidos de uma faixa. */
export function updateTrack(music, trackId, changes) {
  const next = copy(music)
  const track = trackIn(next, trackId)
  for (const key of ["name", "instrument_id", "volume", "mute", "solo"]) {
    if (Object.hasOwn(changes, key)) track[key] = changes[key]
  }
  return next
}

/** Move uma faixa uma posição para cima ou para baixo quando há vizinha. */
export function moveTrack(music, trackId, direction) {
  const next = copy(music)
  const index = next.tracks.findIndex((track) => track.id === trackId)
  if (index < 0) throw new Error("Faixa não encontrada")
  const target = index + direction
  if (target >= 0 && target < next.tracks.length) {
    const [track] = next.tracks.splice(index, 1)
    next.tracks.splice(target, 0, track)
  }
  return next
}

/** Remove uma faixa e suas regiões após confirmação na interface. */
export function removeTrack(music, trackId) {
  const next = copy(music)
  trackIn(next, trackId)
  next.tracks = next.tracks.filter((track) => track.id !== trackId)
  return next
}

/** Acrescenta uma região com posição e duração musicais válidas. */
export function addRegion(music, trackId, region) {
  const next = copy(music)
  const track = trackIn(next, trackId)
  if (track.regions.some((item) => item.id === region.id)) throw new Error("ID de região repetido")
  if (!Number.isInteger(region.duration_ticks) || region.duration_ticks < beatTicks(next)) throw new Error("Duração inválida")
  track.regions.push({ id: region.id, start_tick: snapTick(next, region.start_tick),
    duration_ticks: region.duration_ticks, notes: region.notes.map((note) => ({ ...note })) })
  return next
}

/** Move a região na composição; notas permanecem relativas ao seu início. */
export function moveRegion(music, trackId, regionId, startTick) {
  const next = copy(music)
  const region = regionIn(trackIn(next, trackId), regionId)
  region.start_tick = snapTick(next, startTick)
  return next
}

/** Altera o fim sem cortar notas e mantém pelo menos uma batida de duração. */
export function resizeRegion(music, trackId, regionId, requestedDuration) {
  const next = copy(music)
  const region = regionIn(trackIn(next, trackId), regionId)
  const lastNoteEnd = region.notes.reduce((end, note) => Math.max(end, note.onset_tick + note.duration_ticks), 0)
  const beat = beatTicks(next)
  region.duration_ticks = Math.max(beat, Math.ceil(lastNoteEnd / beat) * beat,
    Math.round(requestedDuration / beat) * beat)
  return next
}

/** Exclui somente a região selecionada da faixa correta. */
export function removeRegion(music, trackId, regionId) {
  const next = copy(music)
  const track = trackIn(next, trackId)
  regionIn(track, regionId)
  track.regions = track.regions.filter((region) => region.id !== regionId)
  return next
}
