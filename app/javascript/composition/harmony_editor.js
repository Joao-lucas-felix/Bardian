import { toEditorNotes, replaceRegionNotes } from "composition/region_notes"
import { roleTrack, ensureAdditional, coverRegions, validateDeclared, harmonyEnd } from "composition/harmony_draft"

/** Projeta uma camada por papel, sem criar a faixa virtual nem quantizar eventos. */
export function editorState(document, role = "realization") {
  const region = roleTrack(document, role)?.regions[0]
  return { notes: region ? toEditorNotes(region) : [],
    totalTicks: document.harmony ? Math.max(1920, harmonyEnd(document) + 1920) : (region?.duration_ticks || 1920),
    numerator: document.time_signature.numerator, denominator: document.time_signature.denominator, bpm: document.bpm }
}

/** Valida o gesto inteiro; permite caudas sem mover notas entre camadas implicitamente. */
export function applyEditorNotes(document, notes, role = "realization") {
  if (!Array.isArray(notes)) throw new Error("Notas inválidas")
  if (!document.harmony && role === "realization") {
    const track = roleTrack(document)
    return replaceRegionNotes(document, track.id, track.regions[0].id, notes)
  }
  if (!notes.length && !roleTrack(document, role)) return structuredClone(document)
  const next = structuredClone(document)
  const track = role === "additional" ? ensureAdditional(next, () => crypto.randomUUID()) : roleTrack(next)
  const region = track.regions[0]
  const ends = notes.map(note => note.onset + note.duration)
  if (ends.some(end => !Number.isSafeInteger(end))) throw new Error("Tempo inválido")
  region.duration_ticks = Math.max(region.duration_ticks, ...ends)
  const changed = replaceRegionNotes(next, track.id, region.id, notes)
  if (changed.harmony) validateDeclared(changed)
  return coverRegions(changed)
}
