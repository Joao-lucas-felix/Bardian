/**
 * Atualiza as faixas do grafo sem recriar um instrumento cujo timbre não mudou.
 * `slots` guarda no máximo as duas unidades da composição; `tracks` contém as
 * faixas mapeadas para ticks do motor e `createInstrument` monta uma unidade nova.
 * A chamada deve ocorrer dentro de `project.editing.modify` com o transporte parado.
 * Retorna os slots reutilizáveis para a próxima preparação da mesma sessão.
 */
export function syncHarmonyTracks(project, slots, tracks, createInstrument) {
  const next = [...slots]
  const size = Math.max(next.length, tracks.length)
  for (let index = 0; index < size; index += 1) {
    const track = tracks[index]
    let slot = next[index]
    if (slot && track && slot.instrumentId !== track.instrumentId) {
      project.api.deleteAudioUnit(slot.product.audioUnitBox)
      slot = undefined
    }
    if (!slot && track) slot = { instrumentId: track.instrumentId, product: createInstrument(track) }
    if (!slot) continue

    const { product } = slot
    // A prévia usa só a primeira faixa; a segunda fica vazia e muda até a volta.
    for (const { box } of [...product.trackBox.regions.pointerHub.incoming()]) box.delete()
    if (track) {
      product.audioUnitBox.volume.setValue(track.volumeDb)
      product.audioUnitBox.mute.setValue(track.mute)
      product.audioUnitBox.solo.setValue(track.solo)
      for (const region of track.regions) {
        const box = project.api.createNoteRegion({ trackBox: product.trackBox,
          position: region.position, duration: region.duration, loopDuration: region.duration })
        for (const note of region.notes) project.api.createNoteEvent({ owner: box, ...note })
      }
    } else {
      product.audioUnitBox.mute.setValue(true)
      product.audioUnitBox.solo.setValue(false)
    }
    next[index] = slot
  }
  return next
}
