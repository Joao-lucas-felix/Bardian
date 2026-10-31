import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Exercita a projeção visual real com um contexto Canvas mínimo e observável.
const source = readFileSync(new URL("../../app/javascript/creation/phrase_waveform.js", import.meta.url), "utf8")
  .replace("export function drawPhraseWaveform", "function drawPhraseWaveform")
const drawPhraseWaveform = vm.runInNewContext(`${source}\ndrawPhraseWaveform`)

/** Registra as operações de desenho sem simular regras musicais. */
function canvas(width = 400, height = 48) {
  const operations = []
  const context = {
    setTransform(...values) { operations.push(["scale", ...values]) },
    clearRect(...values) { operations.push(["clear", ...values]) },
    fillRect(...values) { operations.push(["fill", ...values]) },
    beginPath() { operations.push(["begin"]) },
    moveTo(...values) { operations.push(["move", ...values]) },
    lineTo(...values) { operations.push(["line", ...values]) },
    stroke() { operations.push(["stroke"]) }
  }
  return { clientWidth: width, clientHeight: height, width: 0, height: 0, getContext: () => context, operations }
}

test("frase vazia desenha grade, sem onda inventada", () => {
  const target = canvas()
  drawPhraseWaveform(target, [], { totalTicks: 7680, color: "#f80", pixelRatio: 1 })
  assert.equal(target.operations.some(([kind]) => kind === "fill"), false)
})

test("eventos simultâneos e de borda nunca ultrapassam o clipe", () => {
  const target = canvas()
  const notes = [
    { onset: 0, duration: 480, velocity: 100 },
    { onset: 0, duration: 480, velocity: 100 },
    { onset: 1920, duration: 480, velocity: 80 },
    { onset: 7560, duration: 480, velocity: 127 },
    { onset: 7680, duration: 480, velocity: 127 }
  ]
  drawPhraseWaveform(target, notes, { totalTicks: 7680, color: "#f80", pixelRatio: 1 })
  const bars = target.operations.filter(([kind]) => kind === "fill")
  assert.ok(bars.length > 0)
  assert.ok(bars.every(([, x, y, width, height]) => x >= 0 && x + width <= 400 && y >= 0 && y + height <= 48))
  assert.ok(bars.some(([, x]) => x < 25))
  assert.ok(bars.some(([, x]) => x >= 100 && x < 125))
  assert.ok(bars.some(([, x]) => x > 375))
})

test("Canvas sem largura é inócuo e escala pixels físicos no resize", () => {
  const zero = canvas(0)
  drawPhraseWaveform(zero, [{ onset: 0, duration: 480, velocity: 100 }], { totalTicks: 7680, color: "#f80", pixelRatio: 2 })
  assert.equal(zero.operations.length, 0)
  const target = canvas()
  drawPhraseWaveform(target, [], { totalTicks: 7680, color: "#f80", pixelRatio: 2 })
  assert.equal(target.width, 800)
  assert.equal(target.height, 96)
  assert.deepEqual(target.operations[0], ["scale", 2, 0, 0, 2, 0, 0])
})
