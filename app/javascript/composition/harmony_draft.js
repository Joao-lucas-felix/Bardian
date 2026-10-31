/** Operações imutáveis de blocos; as notas MIDI continuam sendo a fonte de verdade. */
const DURATIONS = [240, 480, 960, 1920]
const MAX_CHORDS = 32

/** Valida a faixa e agrupa notas por início; entrada nunca é ordenada ou alterada. */
function lane(document) {
  const tracks = document?.tracks
  if (tracks?.length !== 1 || tracks[0]?.regions?.length !== 1) throw new Error("Faixa harmônica inválida")
  const region = tracks[0].regions[0]
  if (!Array.isArray(region.notes)) throw new Error("Notas inválidas")
  const groups = new Map()
  for (const note of region.notes) {
    if (!groups.has(note.onset_tick)) groups.set(note.onset_tick, [])
    groups.get(note.onset_tick).push(note)
  }
  const blocks = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, notes]) => notes)
  if (blocks.length > MAX_CHORDS) throw new Error("Limite de 32 acordes excedido")
  let end = 0
  for (const notes of blocks) {
    const duration = notes[0].duration_ticks
    if (notes.length !== 3 || !DURATIONS.includes(duration) ||
      notes.some(note => note.onset_tick !== end || note.duration_ticks !== duration)) {
      throw new Error("Edição livre: use o piano roll")
    }
    end += duration
  }
  if (blocks.length && region.duration_ticks !== end) throw new Error("Edição livre: use o piano roll")
  return { region, blocks, end }
}

/** Reposiciona cópias de blocos contíguos e ajusta o limite da região. */
function arrange(region, blocks) {
  let end = 0
  region.notes = blocks.flatMap(notes => {
    const result = notes.map(note => ({ ...note, onset_tick: end }))
    end += notes[0].duration_ticks
    return result
  })
  region.duration_ticks = blocks.length ? end : 480
}

/** Rejeita índices que não identificam um bloco existente. */
function checkIndex(index, count) {
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error("Posição de acorde inválida")
}

/** Acrescenta tríades do domínio, de um tempo cada, com IDs únicos. Retorna cópia. */
export function appendChords(document, chords, idFactory) {
  if (document.harmony) return appendDeclared(document, chords, idFactory)
  const next = structuredClone(document)
  const { region, blocks, end } = lane(next)
  if (!Array.isArray(chords) || !chords.length || typeof idFactory !== "function") throw new Error("Acordes inválidos")
  if (blocks.length + chords.length > MAX_CHORDS) throw new Error("Limite de 32 acordes excedido")
  const used = new Set([next.id, next.tracks[0].id, region.id, ...region.notes.map(note => note.id)])
  chords.forEach((chord, index) => {
    if (chord?.onset_tick !== end + index * 480) throw new Error("Posição do próximo tempo inválida")
    if (chord.pitches?.length !== 3 || !chord.pitches.every(p => Number.isInteger(p) && p >= 0 && p <= 127)) throw new Error("Pitch sugerido inválido")
    blocks.push(chord.pitches.map(pitch => {
      const id = idFactory()
      if (typeof id !== "string" || !id.trim() || used.has(id)) throw new Error("ID de nota repetido ou inválido")
      used.add(id)
      return { id, pitch, onset_tick: chord.onset_tick, duration_ticks: 480, velocity: 90 }
    }))
  })
  arrange(region, blocks)
  return next
}

/** Retira o último bloco; vazio é preservado sem efeitos colaterais. */
export function removeLastChord(document) {
  if (document.harmony) return document.harmony.blocks.length ? removeChord(document, document.harmony.blocks.at(-1).id) : structuredClone(document)
  const { blocks } = lane(document)
  return blocks.length ? removeChord(document, blocks.length - 1) : structuredClone(document)
}

/** Move um bloco conservando notas, identidades e duração; recalcula somente inícios. */
export function moveChord(document, from, to) {
  if (document.harmony) return editDeclared(document, from, "move", to)
  const next = structuredClone(document)
  const { region, blocks } = lane(next)
  checkIndex(from, blocks.length)
  checkIndex(to, blocks.length)
  blocks.splice(to, 0, blocks.splice(from, 1)[0])
  arrange(region, blocks)
  return next
}

/** Remove um bloco e fecha o espaço com base em sua duração real. */
export function removeChord(document, index) {
  if (document.harmony) return editDeclared(document, index, "remove")
  const next = structuredClone(document)
  const { region, blocks } = lane(next)
  checkIndex(index, blocks.length)
  blocks.splice(index, 1)
  arrange(region, blocks)
  return next
}

/**
 * Retorna cópia com a duração solicitada (ticks), identificando o bloco por ID
 * na harmonia declarada ou índice no legado. Escala início relativo e duração
 * das notas; desloca sucessores e rejeita duração fora das opções permitidas.
 */
export function resizeChord(document, index, durationTicks) {
  if (document.harmony) return editDeclared(document, index, "resize", durationTicks)
  if (!DURATIONS.includes(durationTicks)) throw new Error("Duração de acorde inválida")
  const next = structuredClone(document)
  const { region, blocks } = lane(next)
  checkIndex(index, blocks.length)
  blocks[index] = blocks[index].map(note => ({ ...note, duration_ticks: durationTicks }))
  arrange(region, blocks)
  return next
}

/** Localiza faixa pelo papel; fallback único mantém o editor legado compatível. */
export function roleTrack(document, role = "realization") {
  if (!["realization", "additional"].includes(role)) throw new Error("Camada inválida")
  const id = `${role === "additional" ? "harmony-extra" : "harmony"}-${document.id}`
  return document.tracks.find(track => track.id === id) ||
    (role === "realization" && !document.harmony && document.tracks.length === 1 ? document.tracks[0] : null)
}

/** Coleta todas as identidades conhecidas, incluindo declarações e faixas externas. */
export function documentIds(document) {
  return new Set([document.id, ...(document.harmony?.blocks || []).map(block => block.id),
    ...document.tracks.flatMap(track => [track.id, ...track.regions.flatMap(region => [region.id, ...region.notes.map(note => note.id)])])])
}

/** Reserva um ID sem aceitar colisão ou vazio; falhas não modificam a entrada. */
function allocate(used, factory) {
  const id = factory()
  if (typeof id !== "string" || !id.trim() || used.has(id)) throw new Error("ID repetido ou inválido")
  used.add(id)
  return id
}

/** Fim navegável ignora padding técnico de regiões vazias e inclui caudas. */
export function harmonyEnd(document) {
  const ends = (document.harmony?.blocks || []).map(block => block.onset_tick + block.duration_ticks)
  for (const role of ["realization", "additional"]) {
    for (const region of roleTrack(document, role)?.regions || []) {
      for (const note of region.notes) ends.push(region.start_tick + note.onset_tick + note.duration_ticks)
    }
  }
  return Math.max(0, ...ends)
}

/** Valida declarações e associação antes de publicar qualquer operação no rascunho. */
export function validateDeclared(document) {
  const blocks = document.harmony?.blocks
  if (!Array.isArray(blocks) || blocks.length > MAX_CHORDS) throw new Error("Limite de 32 acordes excedido")
  let end = 0
  for (const block of blocks) {
    if (!Number.isSafeInteger(block.onset_tick) || block.onset_tick !== end || !DURATIONS.includes(block.duration_ticks) ||
        !/^[A-G](bb|b|##|#)?$/.test(block.chord?.root || "") || !["major", "minor", "diminished"].includes(block.chord?.quality)) throw new Error("Bloco harmônico inválido")
    end += block.duration_ticks
    if (!Number.isSafeInteger(end)) throw new Error("Tempo inválido")
  }
  const ids = [document.id, ...blocks.map(block => block.id), ...document.tracks.flatMap(track => [track.id,
    ...track.regions.flatMap(region => [region.id, ...region.notes.map(note => note.id)])])]
  if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) throw new Error("ID repetido ou inválido")
  for (const note of roleTrack(document)?.regions[0]?.notes || []) {
    if (!blocks.some(block => note.onset_tick >= block.onset_tick && note.onset_tick < block.onset_tick + block.duration_ticks)) throw new Error("O início da nota precisa estar dentro de um acorde; use Notas adicionais fora dos blocos")
  }
}

/** Amplia/reduz regiões gerenciadas para cobrir blocos e notas sem truncar eventos. */
export function coverRegions(document) {
  const end = (document.harmony?.blocks || []).reduce((sum, block) => sum + block.duration_ticks, 0)
  for (const role of ["realization", "additional"]) {
    const region = roleTrack(document, role)?.regions[0]
    if (region) region.duration_ticks = Math.max(480, end, ...region.notes.map(note => note.onset_tick + note.duration_ticks))
  }
  return document
}

/**
 * Aplica remoção, movimento ou redimensionamento ao bloco identificado por ID.
 * Captura associações antes de editar: redimensionar escala o tempo interno,
 * inclusive caudas, sem alterar alturas, intensidades ou notas adicionais.
 * Retorna uma cópia validada; erros deixam o documento recebido intacto.
 */
function editDeclared(document, blockId, operation, value) {
  validateDeclared(document)
  const next = structuredClone(document), blocks = next.harmony.blocks
  const index = blocks.findIndex(block => block.id === blockId)
  checkIndex(index, blocks.length)
  const notes = roleTrack(next).regions[0].notes
  const groups = new Map(blocks.map(block => [block.id, { start: block.onset_tick, end: block.onset_tick + block.duration_ticks,
    notes: notes.filter(note => note.onset_tick >= block.onset_tick && note.onset_tick < block.onset_tick + block.duration_ticks) }]))
  if (operation === "resize") {
    if (!DURATIONS.includes(value)) throw new Error("Duração inválida")
    blocks[index].duration_ticks = value
  } else if (operation === "remove") blocks.splice(index, 1)
  else { checkIndex(value, blocks.length); blocks.splice(value, 0, blocks.splice(index, 1)[0]) }
  let onset = 0
  roleTrack(next).regions[0].notes = blocks.flatMap(block => {
    const group = groups.get(block.id), delta = onset - group.start
    block.onset_tick = onset
    onset += block.duration_ticks
    return group.notes.map(note => {
      if (operation !== "resize" || block.id !== blockId) return { ...note, onset_tick: note.onset_tick + delta }
      const ratio = block.duration_ticks / (group.end - group.start)
      // Ticks inteiros podem perder precisão ao reduzir. O limite impede que
      // arredondar uma entrada tardia transfira a nota para o próximo acorde.
      const offset = Math.min(block.duration_ticks - 1, Math.round((note.onset_tick - group.start) * ratio))
      return { ...note, onset_tick: block.onset_tick + offset,
        duration_ticks: Math.max(1, Math.round(note.duration_ticks * ratio)) }
    })
  })
  validateDeclared(next)
  return coverRegions(next)
}

/** Adiciona declaração e realização no mesmo snapshot, com identidades novas. */
function appendDeclared(document, chords, factory) {
  validateDeclared(document)
  if (!Array.isArray(chords) || !chords.length || document.harmony.blocks.length + chords.length > MAX_CHORDS) throw new Error("Limite de 32 acordes excedido")
  const next = structuredClone(document), used = documentIds(next)
  let end = next.harmony.blocks.reduce((sum, block) => sum + block.duration_ticks, 0)
  for (const chord of chords) {
    if (chord.onset_tick !== end || chord.pitches?.length !== 3 || !chord.pitches.every(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127)) throw new Error("Posição ou pitch sugerido inválido")
    next.harmony.blocks.push({ id: allocate(used, factory), onset_tick: end, duration_ticks: 480, chord: structuredClone(chord.chord) })
    for (const pitch of chord.pitches) roleTrack(next).regions[0].notes.push({ id: allocate(used, factory), pitch, onset_tick: end, duration_ticks: 480, velocity: 90 })
    end += 480
  }
  validateDeclared(next)
  return coverRegions(next)
}

/** Cria camada adicional somente quando recebe conteúdo; conserva timbre/propriedades existentes. */
export function ensureAdditional(document, factory) {
  let track = roleTrack(document, "additional")
  if (track) return track
  const used = documentIds(document), id = `harmony-extra-${document.id}`
  if (used.has(id)) throw new Error("ID de faixa adicional em uso")
  used.add(id)
  track = { ...structuredClone(roleTrack(document)), id, name: "Notas adicionais",
    regions: [{ id: allocate(used, factory), start_tick: 0, duration_ticks: 480, notes: [] }] }
  document.tracks.push(track)
  return track
}

/** Confirma partição completa dos IDs; nenhum evento é inferido, apagado ou duplicado. */
export function applyRecovery(document, blocks, assignments, factory) {
  const next = structuredClone(document), source = roleTrack(next).regions[0]
  const notes = source.notes
  if (!assignments || Object.keys(assignments).length !== notes.length || notes.some(note => !["realization", "additional"].includes(assignments[note.id]))) throw new Error("A partição deve incluir cada nota exatamente uma vez")
  next.harmony = { blocks: structuredClone(blocks) }
  const extra = notes.filter(note => assignments[note.id] === "additional")
  // Reserva a região enquanto os IDs das notas ainda constam da realização.
  const target = extra.length ? ensureAdditional(next, factory).regions[0] : null
  source.notes = notes.filter(note => assignments[note.id] === "realization")
  if (target) target.notes.push(...extra)
  validateDeclared(next)
  return coverRegions(next)
}
