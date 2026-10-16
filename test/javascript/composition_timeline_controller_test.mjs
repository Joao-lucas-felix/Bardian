import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import * as state from "../../app/javascript/composition/timeline_state.js"

// Carrega o controller com Stimulus mínimo para verificar o protocolo de salvamento.
const source = readFileSync(new URL("../../app/javascript/controllers/composition_timeline_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class TimelineController extends Controller")
  .concat("\nTimelineController")
const Controller = vm.runInNewContext(source, {
  Controller: class {}, ...state, crypto: { randomUUID: () => "uuid" },
  document: { querySelector: () => ({ content: "token" }) },
  window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }
})

// Metadados editados entram no mesmo JSON que contém as faixas.
test("metadados atualizam o documento sem perder as faixas", () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Antes", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [{ id: "faixa" }] }
  controller.nameTarget = { value: "Depois" }
  controller.bpmTarget = { value: "90" }
  controller.numeratorTarget = { value: "3" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.changeMetadata()
  assert.equal(controller.music.name, "Depois")
  assert.equal(controller.music.bpm, 90)
  assert.equal(controller.music.time_signature.numerator, 3)
  assert.equal(controller.music.tracks[0].id, "faixa")
})

// Um conflito não substitui o trabalho local nem avança a versão de salvamento.
test("conflito ao salvar preserva o documento local", async () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Local", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [] }
  controller.lockVersion = 2
  controller.urlValue = "/compositions/id.json"
  controller.formTarget = { reportValidity: () => true }
  controller.nameTarget = { value: "Local" }
  controller.bpmTarget = { value: "120" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.saveButtonTarget = { disabled: false }
  controller.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: "Conflito" }) })
  let prevented = false
  await controller.save({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(controller.music.name, "Local")
  assert.equal(controller.lockVersion, 2)
  assert.match(controller.statusTarget.textContent, /Conflito/)
})

// Uma resposta tardia confirma a versão, mas não apaga edições feitas durante o envio.
test("salvamento tardio preserva edicoes posteriores", async () => {
  const controller = new Controller()
  controller.render = () => {}
  controller.music = { name: "Primeira", bpm: 120, time_signature: { numerator: 4, denominator: 4 }, tracks: [] }
  controller.lockVersion = 0
  controller.urlValue = "/compositions/id.json"
  const versionField = { value: 0 }
  controller.formTarget = { reportValidity: () => true, querySelector: () => versionField }
  controller.nameTarget = { value: "Primeira" }
  controller.bpmTarget = { value: "120" }
  controller.numeratorTarget = { value: "4" }
  controller.denominatorTarget = { value: "4" }
  controller.statusTarget = { textContent: "" }
  controller.saveButtonTarget = { disabled: false }
  let resolveRequest
  controller.fetch = () => new Promise((resolve) => { resolveRequest = resolve })
  const saving = controller.save({ preventDefault() {} })
  controller.music.name = "Segunda"
  controller.revision = 1
  resolveRequest({ ok: true, json: async () => ({ document: { name: "Primeira" }, lock_version: 1 }) })
  await saving
  assert.equal(controller.music.name, "Segunda")
  assert.equal(controller.lockVersion, 1)
  assert.match(controller.statusTarget.textContent, /ainda não salvas/)
})
