import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePresetIndex, createSoundfontBank } from '../../app/audio_engine/harmony_soundfonts.js'

// Fronteira mínima do Option do SDK; o carregamento e a resolução continuam reais.
const option = { None: null, wrap: value => ({ unwrap: () => value }) }
const bytes = new Uint8Array([1, 2, 3]).buffer
const definition = { name: 'Bank', path: '/bank.sf2', size: 3, sha256: 'abc', license: 'MIT' }
const parsed = { presets: [{ header: { bank: 0, preset: 4 } }] }
/** Monta armazenamento e rede controláveis para exercitar falhas recuperáveis. */
function fixture(overrides = {}) {
  const calls = []
  const storage = { load: async () => { throw new DOMException('ausente', 'NotFoundError') }, save: async () => { calls.push('save') }, deleteItem: async () => calls.push('delete') }
  const bank = createSoundfontBank({ definition, uuid: new Uint8Array([1]), option, storage,
    digest: async () => 'abc', parse: async () => parsed,
    fetcher: async () => { calls.push('fetch'); return new Response(bytes) }, ...overrides })
  return { bank, calls }
}
test('resolve banco e programa sem assumir ordem do array', () => {
  assert.equal(resolvePresetIndex([{ header: { bank: 128, preset: 4 } }, ...parsed.presets], 0, 4), 1)
  assert.throws(() => resolvePresetIndex(parsed.presets, 0, 9), /Timbre/)
  assert.throws(() => resolvePresetIndex([...parsed.presets, ...parsed.presets], 0, 4), /Timbre/)
})
test('compartilha carga, guarda banco e reutiliza interpretação', async () => {
  const { bank, calls } = fixture()
  assert.deepEqual(await Promise.all([bank.ensure(), bank.ensure()]), [parsed, parsed])
  await bank.ensure()
  assert.deepEqual(calls, ['fetch', 'save'])
  bank.dispose()
})
test('cache válido dispensa rede e cache corrompido é recuperado', async () => {
  const events = []
  const { bank, calls } = fixture({ storage: { load: async () => [new ArrayBuffer(0), {}], deleteItem: async () => events.push('delete'), save: async () => events.push('save') } })
  await bank.ensure()
  assert.deepEqual(events, ['delete', 'save'])
  assert.deepEqual(calls, ['fetch'])
  bank.dispose()
  const cached = fixture({ storage: { load: async () => [bytes, {}] } })
  await cached.bank.ensure()
  assert.deepEqual(cached.calls, [])
  cached.bank.dispose()
})
test('falha HTTP publica erro e uma nova tentativa recupera', async () => {
  let attempts = 0
  const { bank } = fixture({ fetcher: async () => ++attempts === 1 ? new Response('', { status: 404 }) : new Response(bytes) })
  await assert.rejects(bank.ensure(), /baixar/)
  assert.equal(bank.getOrCreate(new Uint8Array([1])).state.type, 'error')
  assert.equal(await bank.ensure(), parsed)
  bank.dispose()
})
test('cancelar espera não inicia som nem cancela outro consumidor', async () => {
  const controller = new AbortController()
  const { bank } = fixture()
  const canceled = bank.ensure({ signal: controller.signal })
  const valid = bank.ensure()
  controller.abort()
  await assert.rejects(canceled, { name: 'AbortError' })
  assert.equal(await valid, parsed)
  bank.dispose()
})
test('falhas de quota e parser terminam a espera com erro', async () => {
  const quota = fixture({ storage: { load: async () => { throw new DOMException('', 'NotFoundError') }, save: async () => { throw new Error('quota') } } })
  await assert.rejects(quota.bank.ensure(), /armazenar/)
  quota.bank.dispose()
  const invalid = fixture({ parse: async () => { throw new Error('bad sf2') } })
  await assert.rejects(invalid.bank.ensure(), /interpretar/)
  invalid.bank.dispose()
})

test('espera com prazo termina mesmo quando armazenamento não responde', async () => {
  const { bank } = fixture({ timeoutMs: 15, storage: { load: () => new Promise(() => {}) } })
  await assert.rejects(bank.ensure(), /demoraram/)
  bank.dispose()
})
