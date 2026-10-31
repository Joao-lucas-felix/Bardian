import assert from 'node:assert/strict'
import test from 'node:test'
import { syncHarmonyTracks } from '../../app/audio_engine/harmony_track_cache.js'

/** Simula somente a borda do grafo openDAW para observar a identidade das unidades e as notas. */
function setup() {
  const units = []
  const project = { api: {
    deleteAudioUnit(unit) { unit.deleted = true },
    createNoteRegion({ trackBox }) {
      const region = { deleted: false, notes: [], delete() { this.deleted = true; trackBox.boxes = trackBox.boxes.filter(item => item !== this) } }
      trackBox.boxes.push(region)
      return region
    },
    createNoteEvent({ owner, pitch }) { owner.notes.push(pitch) }
  } }
  const createInstrument = track => {
    const product = { audioUnitBox: { deleted: false, volume: { setValue() {} }, mute: { setValue() {} }, solo: { setValue() {} } },
      trackBox: { boxes: [], regions: { pointerHub: { incoming() { return product.trackBox.boxes.map(box => ({ box })) } } } } }
    units.push(product)
    return product
  }
  const track = (instrumentId, pitch) => ({ instrumentId, name: 'Harmonia', volumeDb: -6, mute: false, solo: false,
    regions: [{ position: 0, duration: 480, notes: [{ pitch, position: 0, duration: 480 }] }] })
  return { project, units, createInstrument, track }
}

test('edição de notas preserva instrumento e substitui regiões antigas', () => {
  const f = setup()
  let slots = syncHarmonyTracks(f.project, [], [f.track('piano', 60)], f.createInstrument)
  const first = slots[0].product.trackBox.boxes[0]
  slots = syncHarmonyTracks(f.project, slots, [f.track('piano', 64)], f.createInstrument)
  assert.equal(f.units.length, 1)
  assert.equal(first.deleted, true)
  assert.deepEqual(slots[0].product.trackBox.boxes[0].notes, [64])
})

test('prévia de uma faixa preserva a segunda unidade silenciada para a composição', () => {
  const f = setup()
  let slots = syncHarmonyTracks(f.project, [], [f.track('piano', 60), f.track('piano', 67)], f.createInstrument)
  const second = slots[1].product
  slots = syncHarmonyTracks(f.project, slots, [f.track('piano', 62)], f.createInstrument)
  assert.equal(second.audioUnitBox.deleted, false)
  assert.deepEqual(second.trackBox.boxes, [])
  slots = syncHarmonyTracks(f.project, slots, [f.track('piano', 60), f.track('piano', 67)], f.createInstrument)
  assert.equal(f.units.length, 2)
  assert.equal(slots[1].product, second)
})

test('troca de timbre libera unidade antiga da faixa e cria a escolhida', () => {
  const f = setup()
  let slots = syncHarmonyTracks(f.project, [], [f.track('piano', 60)], f.createInstrument)
  const old = slots[0].product
  slots = syncHarmonyTracks(f.project, slots, [f.track('strings', 60)], f.createInstrument)
  assert.equal(old.audioUnitBox.deleted, true)
  assert.equal(f.units.length, 2)
  assert.equal(slots[0].instrumentId, 'strings')
})
