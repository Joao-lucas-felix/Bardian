import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Usa o controller real com relógio controlado para verificar duração e limpeza do aviso.
const source = readFileSync(new URL("../../app/javascript/controllers/flash_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class FlashController extends Controller")
  .concat("\nFlashController")

/** Prepara um aviso sem navegador real e devolve o temporizador para o teste. */
function flash(autoDismiss) {
  let callback
  const cleared = []
  const Controller = vm.runInNewContext(source, {
    Controller: class {}, window: {
      setTimeout(fn, delay) { callback = { fn, delay }; return 7 },
      clearTimeout(id) { cleared.push(id) }
    }
  })
  const instance = new Controller()
  instance.autoDismissValue = autoDismiss
  instance.element = { removed: false, remove() { this.removed = true } }
  return { instance, get callback() { return callback }, cleared }
}

test("aviso de sucesso desaparece após cinco segundos", () => {
  const state = flash(true)
  state.instance.connect()
  assert.equal(state.callback.delay, 5000)
  assert.equal(state.instance.element.removed, false)
  state.callback.fn()
  assert.equal(state.instance.element.removed, true)
})

test("alerta de erro permanece até a pessoa fechar", () => {
  const state = flash(false)
  state.instance.connect()
  assert.equal(state.callback, undefined)
  state.instance.dismiss()
  assert.equal(state.instance.element.removed, true)
})

test("sair da página cancela o temporizador anterior", () => {
  const state = flash(true)
  state.instance.connect()
  state.instance.disconnect()
  assert.deepEqual(state.cleared, [7])
})
