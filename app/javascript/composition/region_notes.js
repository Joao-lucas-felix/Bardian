/**
 * Faz a ponte entre notas relativas de MidiRegion e o estado do piano roll.
 * Nenhuma função usa pixels ou altera a composição recebida.
 */

/** Localiza uma região dentro da faixa indicada, sem procurar em outras faixas. */
export function regionFor(music, trackId, regionId) {
  const track = music.tracks.find((item) => item.id === trackId)
  const region = track?.regions.find((item) => item.id === regionId)
  if (!region) throw new Error("Região não encontrada na faixa")
  return region
}

/** Confere os limites do contrato MIDI e o fim da região antes da conversão. */
function validateNote(note, regionDuration) {
  if (typeof note.id !== "string" || !note.id.trim()) throw new Error("ID de nota inválido")
  if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) throw new Error("Pitch MIDI inválido")
  if (!Number.isInteger(note.onset) || note.onset < 0) throw new Error("Início de nota inválido")
  if (!Number.isInteger(note.duration) || note.duration < 1) throw new Error("Duração de nota inválida")
  if (!Number.isInteger(note.velocity) || note.velocity < 1 || note.velocity > 127) throw new Error("Velocity MIDI inválida")
  if (note.onset + note.duration > regionDuration) throw new Error("Nota excede a região")
}

/** Converte ticks locais para os nomes esperados pelo editor, com cópias novas. */
export function toEditorNotes(region) {
  if (!Number.isInteger(region.duration_ticks) || region.duration_ticks < 1 || !Array.isArray(region.notes)) {
    throw new Error("Região MIDI inválida")
  }
  const notes = region.notes.map((note) => ({ id: note.id, pitch: note.pitch,
    onset: note.onset_tick, duration: note.duration_ticks, velocity: note.velocity }))
  notes.forEach((note) => validateNote(note, region.duration_ticks))
  if (new Set(notes.map((note) => note.id)).size !== notes.length) throw new Error("IDs de nota repetidos")
  return notes
}

/** Reúne todos os IDs musicais para evitar colisões entre regiões ou tipos. */
function allIds(music) {
  const ids = new Set([music.id, ...(music.harmony?.blocks || []).map(block => block.id)])
  for (const track of music.tracks) {
    ids.add(track.id)
    for (const region of track.regions) {
      ids.add(region.id)
      for (const note of region.notes) ids.add(note.id)
    }
  }
  return ids
}

/** Substitui apenas as notas da região ativa após validar limites e IDs globais. */
export function replaceRegionNotes(music, trackId, regionId, editorNotes) {
  if (!Array.isArray(editorNotes)) throw new Error("Notas inválidas")
  const region = regionFor(music, trackId, regionId)
  const occupied = allIds(music)
  for (const note of region.notes) occupied.delete(note.id)
  for (const note of editorNotes) {
    validateNote(note, region.duration_ticks)
    if (occupied.has(note.id)) throw new Error("ID musical repetido")
    occupied.add(note.id)
  }
  const next = structuredClone(music)
  regionFor(next, trackId, regionId).notes = editorNotes.map((note) => ({
    id: note.id, pitch: note.pitch, onset_tick: note.onset,
    duration_ticks: note.duration, velocity: note.velocity
  }))
  return next
}

/** Solicita um ID ao gerador até obter um que não exista no documento inteiro. */
export function newNoteId(music, generator) {
  const occupied = allIds(music)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generator()
    if (typeof candidate === "string" && candidate.trim() && !occupied.has(candidate)) return candidate
  }
  throw new Error("Não foi possível gerar ID único para a nota")
}

/** Adiciona uma tríade escolhida à região sem alterar a entrada nem duplicar altura/início. */
export function addSuggestedChord(music, trackId, regionId, suggestion, generator) {
  const region = regionFor(music, trackId, regionId)
  if (!Array.isArray(suggestion?.pitches) || suggestion.pitches.length !== 3 ||
      !Number.isInteger(suggestion.onset) || !Number.isInteger(suggestion.duration) ||
      suggestion.onset < 0 || suggestion.duration < 1 || suggestion.onset + suggestion.duration > region.duration_ticks) {
    throw new Error("Sugestão inválida para a região")
  }
  const notes = toEditorNotes(region)
  const occupied = new Set(notes.map((note) => `${note.pitch}:${note.onset}`))
  let nextMusic = music
  for (const pitch of suggestion.pitches) {
    if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) throw new Error("Pitch sugerido inválido")
    const key = `${pitch}:${suggestion.onset}`
    if (occupied.has(key)) continue
    const id = newNoteId(nextMusic, generator)
    const note = { id, pitch, onset: suggestion.onset, duration: suggestion.duration, velocity: 90 }
    notes.push(note)
    occupied.add(key)
    nextMusic = replaceRegionNotes(nextMusic, trackId, regionId, notes)
  }
  return nextMusic
}
