import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

/** Simula o mapa para verificar seleção, foco e gravação sem depender de temporizadores. */
function setup({ reduced = false, fail = false } = {}) {
  const requests = [], animations = []
  const source = readFileSync(new URL("../../app/javascript/controllers/bard_travel_controller.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace("export default class extends Controller", "class Travel extends Controller") + "\nTravel"
  const Travel = vm.runInNewContext(source, { Controller: class {}, window: { matchMedia: () => ({ matches: reduced }) }, document: { querySelector: () => ({ content: "token" }) }, fetch: async (url, options) => { requests.push({ url, options }); return { ok: !fail } } })
  const instance = new Travel()
  const summary = { open: false, showModal() { this.open = true }, close() { this.open = false }, focus() { this.focused = true }, scrollIntoView() {} }
  const button = { setAttribute(key, value) { this[key] = value }, focus() { this.focused = true } }
  const stop = { dataset: { slug: "tempos", visitUrl: "/tempos/visita" }, getBoundingClientRect: () => ({ top: 100, width: 400, height: 240 }), querySelector: selector => selector === "button" ? button : summary, scrollIntoView() {} }
  instance.stopTargets = [stop]
  instance.messageTarget = { textContent: "" }
  instance.travellerTarget = { style: {}, animate: points => { animations.push(points); return { finished: Promise.resolve(), cancel() {} } } }
  instance.element = { clientWidth: 400, isConnected: true, classList: { add() {} }, getBoundingClientRect: () => ({ top: 0 }) }
  instance.connect()
  const event = { currentTarget: { closest: () => stop } }
  return { instance, summary, button, stop, requests, animations, event }
}

test("parte da estrada e revela resumo somente após chegar", async () => {
  const s = setup()
  assert.equal(s.instance.position.y, 48)
  assert.equal(s.summary.open, false)
  const pending = s.instance.select(s.event)
  assert.equal(s.summary.open, false)
  await pending
  assert.equal(s.summary.open, true)
  assert.equal(s.summary.focused, true)
  assert.equal(s.instance.travellerTarget.hidden, true)
  assert.equal(s.requests.length, 1)
  assert.equal(s.requests[0].options.headers["X-CSRF-Token"], "token")
  s.instance.close({})
  assert.equal(s.summary.open, false)
  assert.equal(s.button.focused, true)
})

test("movimento reduzido abre resumo sem animação e erro de gravação permite leitura", async () => {
  const s = setup({ reduced: true, fail: true })
  await s.instance.select(s.event)
  assert.equal(s.animations.length, 0)
  assert.equal(s.summary.open, true)
  assert.match(s.instance.messageTarget.textContent, /não foi salva/)
})

test("restaura última parada e não salva prévia editorial", async () => {
  const s = setup()
  s.instance.lastValue = "tempos"
  s.instance.connect()
  assert.equal(s.instance.position.x, 300)
  s.stop.dataset.visitUrl = ""
  await s.instance.select(s.event)
  assert.equal(s.requests.length, 0)
})

test("cliques concorrentes não iniciam duas visitas", async () => {
  const s = setup()
  await Promise.all([s.instance.select(s.event), s.instance.select(s.event)])
  assert.equal(s.requests.length, 1)
  assert.equal(s.animations.length, 1)
})

// A estrada deve acompanhar o aumento do cenário, mantendo a porta e o seletor alinhados.
test("escala o trajeto e a porta com a altura do cenário", () => {
  const s = setup()
  s.stop.getBoundingClientRect = () => ({ top: 100, width: 800, height: 480 })
  assert.equal(s.instance.point(s.stop).y, 380)
  assert.equal(s.instance.point(s.stop, true).y, 364)
  assert.equal(s.instance.point(s.stop, true).x, 600)
})

// A posição inicial acompanha a mesma escala uniforme usada nas árvores e na estrada.
test("posição inicial acompanha a escala da câmera", () => {
  const s = setup()
  s.instance.element.clientWidth = 680
  assert.equal(s.instance.origin().x, 340)
  assert.equal(s.instance.origin().y, 81.6)
})

// A seleção deve mover o scroll interno, sem chamar scrollIntoView nos ancestrais.
test("enquadra resumo somente dentro do mapa", () => {
  const s = setup()
  const viewport = { scrollTop: 0, clientHeight: 400, getBoundingClientRect: () => ({ top: 80 }) }
  s.instance.element.parentElement = viewport
  s.instance.reveal({ getBoundingClientRect: () => ({ top: 600, height: 200 }) })
  assert.equal(viewport.scrollTop, 420)
})

// Escape segue o mesmo encerramento do botão, com foco devolvido ao ponto da estrada.
test("cancelamento do modal fecha e devolve o foco", async () => {
  const s = setup({ reduced: true })
  await s.instance.select(s.event)
  let prevented = false
  s.instance.close({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(s.summary.open, false)
  assert.equal(s.button.focused, true)
  assert.equal(s.instance.travellerTarget.hidden, false)
})

// O intervalo temporal entre quadros acompanha a distância, inclusive nas curvas.
test("curvas arredondadas mantêm velocidade uniforme e chegada exata", () => {
  const s = setup()
  const route = s.instance.walkingRoute([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }])
  assert.equal(route.frames[0].offset, 0)
  assert.equal(route.frames.at(-1).offset, 1)
  assert.equal(route.frames.at(-1).left, "100px")
  assert.equal(route.frames.at(-1).top, "100px")
  assert.ok(route.frames.some(frame => parseFloat(frame.left) > 0 && parseFloat(frame.left) < 8 && parseFloat(frame.top) < 100))
  const ratios = route.frames.slice(1).map((frame, i) => {
    const previous = route.frames[i]
    return Math.hypot(parseFloat(frame.left) - parseFloat(previous.left), parseFloat(frame.top) - parseFloat(previous.top)) / (frame.offset - previous.offset)
  })
  assert.ok(ratios.every(ratio => Math.abs(ratio - ratios[0]) < .0001))
  assert.ok(route.duration < 600)
})

// Pontos duplicados não devem criar espera, coordenadas inválidas ou divisão por zero.
test("trajeto repetido não gera pausas ou valores inválidos", () => {
  const s = setup()
  const route = s.instance.walkingRoute([{ x: 2, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 13 }])
  assert.equal(route.frames.length, 2)
  assert.equal(route.duration, 30)
  assert.equal(s.instance.walkingRoute([{ x: 2, y: 3 }, { x: 2, y: 3 }]).duration, 0)
})
