import assert from "node:assert/strict"
import test from "node:test"
import { createHarmonyPlayback } from "../../app/javascript/audio/opendaw_harmony.js"

/** Borda controlável: somente download/AudioContext são simulados. */
function setup() {
  const calls = []
  let finish
  let prepared
  const engine = { prepare: doc => { prepared = doc }, seek() {}, pause() {}, play: () => calls.push(["play", prepared]), stop: () => calls.push(["stop"]), dispose: () => calls.push(["dispose"]) }
  const context = { state: "running", resume: async () => {}, close: async () => { context.state = "closed" } }
  const playback = createHarmonyPlayback({ contextFactory: () => context,
    loader: () => new Promise(resolve => { finish = () => resolve({ createHarmonyEngine: async () => engine }) }) })
  return { calls, context, playback, finish: () => finish() }
}

test("parar durante download impede inicio tardio", async () => {
  const f = setup()
  const pending = f.playback.play({ tracks: [] })
  await Promise.resolve()
  f.playback.stop()
  f.finish()
  await pending
  assert.equal(f.calls.filter(c => c[0] === "play").length, 0)
  f.playback.dispose()
  assert.equal(f.context.state, "closed")
})

test("ultimo pedido vence e desmontagem libera engine uma unica vez", async () => {
  const f = setup()
  const first = f.playback.play({ name: "antiga" })
  const second = f.playback.play({ name: "atual" })
  await Promise.resolve()
  f.finish()
  await Promise.all([first, second])
  assert.deepEqual(f.calls.filter(c => c[0] === "play"), [["play", { name: "atual" }]])
  f.playback.dispose()
  f.playback.dispose()
  assert.equal(f.calls.filter(c => c[0] === "dispose").length, 1)
})

// O motor é a borda externa; o estado observado e a preservação do documento são do adaptador real.
test("pausa conserva cursor e retoma sem preparar novamente", async () => {
  const events = [], calls = []
  let hooks
  const engine = { prepare(doc, callbacks) { calls.push("prepare"); hooks = callbacks },
    play() { calls.push("play") }, pause() { calls.push("pause") }, seek(tick) { calls.push(["seek", tick]) },
    stop() { calls.push("stop") }, dispose() {} }
  const playback = createHarmonyPlayback({ loader: async () => ({ createHarmonyEngine: async () => engine }),
    contextFactory: () => ({ resume: async () => {}, close: async () => {}, state: "running" }), onState: state => events.push(state) })
  const doc = { id: "song", tracks: [], harmony: { blocks: [{ onset_tick: 0, duration_ticks: 1920 }] } }
  await playback.play(doc)
  hooks.onPosition(720)
  playback.pause()
  assert.equal(events.at(-1).status, "paused")
  assert.equal(events.at(-1).positionTick, 720)
  await playback.play(doc)
  assert.equal(calls.filter(call => call === "prepare").length, 1)
  playback.seek(1000)
  assert.equal(events.at(-1).positionTick, 1000)
  playback.stop()
  hooks.onPosition(1500)
  assert.equal(events.at(-1).positionTick, 0)
  playback.dispose()
})

// A preparação do banco é assíncrona: a intenção atual decide quando tocar.
test('parar durante prepare impede início e nova tentativa aguarda preparação', async () => {
  let release, entered
  const begun = new Promise(resolve => { entered = resolve })
  const calls = []
  const engine = { prepare: async () => { entered(); await new Promise(resolve => { release = resolve }) },
    play: () => calls.push('play'), seek() {}, pause() {}, stop() {}, dispose() {} }
  const playback = createHarmonyPlayback({ loader: async () => ({ createHarmonyEngine: async () => engine }),
    contextFactory: () => ({ resume: async () => {}, close: async () => {}, state: 'running' }) })
  const attempt = playback.play({ tracks: [] })
  await begun
  assert.deepEqual(calls, [])
  playback.stop()
  release()
  await attempt
  assert.deepEqual(calls, [])
  playback.dispose()
})

// Duas intenções concorrentes devem montar grafos em ordem e tocar só a mais recente.
test('nova intenção cancela prepare antigo e ignora seu progresso', async () => {
  let beginFirst, oldHooks
  const entered = new Promise(resolve => { beginFirst = resolve })
  const played = [], states = []; let current
  const engine = { async prepare(doc, hooks) {
    current = doc.name
    if (doc.name === 'antiga') { oldHooks = hooks; beginFirst(); await new Promise((resolve, reject) => hooks.signal.addEventListener('abort', () => reject(hooks.signal.reason), {once:true})) }
  }, play: () => played.push(current), pause() {}, stop() {}, seek() {}, dispose() {} }
  const playback = createHarmonyPlayback({ loader: async () => ({createHarmonyEngine: async () => engine}),
    contextFactory: () => ({resume: async () => {},close: async () => {},state:'running'}), onState: state => states.push(state) })
  const first = playback.play({name:'antiga', tracks:[]}); await entered
  const second = playback.play({name:'atual', tracks:[]})
  oldHooks.onProgress({phase:'download',progress:0.77})
  await Promise.all([first, second])
  assert.deepEqual(played, ['atual'])
  assert.equal(states.some(state => state.progress === 0.77), false)
  playback.dispose()
})

test('preparo antecipado não toca e a escuta seguinte usa o grafo pronto', async () => {
  const calls = []
  const engine = { prepare: async () => calls.push('prepare'), play: () => calls.push('play'),
    pause() {}, seek() {}, stop() {}, dispose() {} }
  const playback = createHarmonyPlayback({ loader: async () => ({ createHarmonyEngine: async () => engine }),
    contextFactory: () => ({ resume: async () => {}, close: async () => {}, state: 'running' }) })
  const document = { id: 'song', tracks: [], harmony: { blocks: [{ onset_tick: 0, duration_ticks: 480 }] } }
  await playback.warm(document)
  assert.deepEqual(calls, ['prepare'])
  await playback.play(document)
  assert.deepEqual(calls, ['prepare', 'play'])
  playback.dispose()
})

test('preparo antecipado antigo não inicia som após nova escolha', async () => {
  let entered, release
  const begun = new Promise(resolve => { entered = resolve })
  const calls = []
  const engine = { async prepare(doc) {
    calls.push(['prepare', doc.name])
    if (doc.name === 'old') { entered(); await new Promise(resolve => { release = resolve }) }
  }, play: () => calls.push('play'), pause() {}, seek() {}, stop() {}, dispose() {} }
  const playback = createHarmonyPlayback({ loader: async () => ({ createHarmonyEngine: async () => engine }),
    contextFactory: () => ({ resume: async () => {}, close: async () => {}, state: 'running' }) })
  const old = playback.warm({ name: 'old', tracks: [] })
  await begun
  const latest = playback.warm({ name: 'latest', tracks: [] })
  release()
  await Promise.all([old, latest])
  assert.deepEqual(calls, [['prepare', 'old'], ['prepare', 'latest']])
  playback.dispose()
})

test('escuta solicitada durante preparo do mesmo timbre aguarda sem recriar grafo', async () => {
  let release, entered
  const begun = new Promise(resolve => { entered = resolve })
  const calls = []
  const engine = { async prepare() { calls.push('prepare'); entered(); await new Promise(resolve => { release = resolve }) },
    play: () => calls.push('play'), pause() {}, seek() {}, stop() {}, dispose() {} }
  const playback = createHarmonyPlayback({ loader: async () => ({ createHarmonyEngine: async () => engine }),
    contextFactory: () => ({ resume: async () => {}, close: async () => {}, state: 'running' }) })
  const document = { id: 'song', tracks: [], harmony: { blocks: [{ onset_tick: 0, duration_ticks: 480 }] } }
  const warming = playback.warm(document)
  await begun
  const playing = playback.play(document)
  release()
  await Promise.all([warming, playing])
  assert.deepEqual(calls, ['prepare', 'play'])
  playback.dispose()
})
