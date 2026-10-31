import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Usa o controlador real; rede e áudio são substituídos pelas bordas externas.
const source = readFileSync(new URL("../../app/javascript/controllers/composition_starter_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class StarterController extends Controller")
  .concat("\nStarterController")
let response, calls
const playback = { stop() { calls.push("stop") }, dispose() {}, preview(document) { calls.push(["play", document.bpm, document.tracks[0].instrument_id]) } }
const Controller = vm.runInNewContext(source, {
  Controller: class {}, createHarmonyPlayback: () => playback,
  fetch: async () => response, document: { querySelector: () => ({ content: "csrf" }) },
  crypto: { randomUUID: () => "preview" }, structuredClone, console
})

/** Prepara apenas os campos usados pelo fluxo de regeneração. */
function setup() {
  calls = []
  const controller = new Controller()
  controller.previewUrlValue = "/compositions/preview"
  controller.bpmTarget = { value: "90" }
  controller.tonicTarget = { value: "C" }
  controller.modeTarget = { value: "major" }
  controller.instrumentTarget = { value: "synth" }
  controller.degreesTarget = { value: "" }
  controller.statusTarget = { textContent: "" }
  controller.renderPreviews = () => {}
  controller.playback = playback
  controller.revision = 0
  response = { ok: true, json: async () => ({ previews: [[
    { index: 0, symbol: "C", pitches: [60, 64, 67] },
    { index: 3, symbol: "F", pitches: [65, 69, 72] },
    { index: 4, symbol: "G", pitches: [67, 71, 74] },
    { index: 0, symbol: "C", pitches: [60, 64, 67] }
  ]] }) }
  return controller
}

test("trocar tonalidade regenera propostas e limpa escolha antiga", async () => {
  const controller = setup()
  controller.degreesTarget.value = "0,3,4,0"
  controller.tonicTarget.value = "D"

  await controller.refreshContext()

  assert.equal(controller.degreesTarget.value, "")
  assert.equal(controller.previews.length, 1)
  assert.equal(controller.selectedIndex, null)
  assert.equal(calls.includes("stop"), true)
})

test("trocar bpm e instrumento conserva acordes para nova escuta", async () => {
  const controller = setup()
  await controller.refreshContext()
  controller.selectPreview({ currentTarget: { dataset: { index: "0" } } })
  const existing = controller.previews
  controller.bpmTarget.value = "110"
  controller.instrumentTarget.value = "fluid_piano"

  controller.updateSound()
  await controller.playPreview({ currentTarget: { dataset: { index: "0" } } })

  assert.equal(controller.degreesTarget.value, "0,3,4,0")
  assert.equal(controller.previews, existing)
  assert.deepEqual(calls.at(-1), ["play", 110, "fluid_piano"])
})

test("resposta atrasada não devolve acordes da tonalidade anterior", async () => {
  const controller = setup()
  let release
  response = { ok: true, json: () => new Promise(resolve => { release = resolve }) }
  const oldRequest = controller.refreshContext()
  await Promise.resolve()
  controller.tonicTarget.value = "D"
  response = { ok: true, json: async () => ({ previews: [[{ index: 0, symbol: "D", pitches: [62, 66, 69] }]] }) }
  await controller.refreshContext()
  release({ previews: [[{ index: 0, symbol: "C", pitches: [60, 64, 67] }]] })
  await oldRequest
  assert.equal(controller.previews[0][0].symbol, "D")
})
