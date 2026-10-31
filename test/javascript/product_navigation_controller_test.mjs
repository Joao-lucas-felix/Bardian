import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const source = readFileSync(new URL("../../app/javascript/controllers/product_navigation_controller.js", import.meta.url), "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class ProductNavigationController extends Controller")
  .concat("\nProductNavigationController")
const Controller = vm.runInNewContext(source, {
  Controller: class {},
  document: { body: { classList: { toggle() {} } }, addEventListener() {}, removeEventListener() {} }
})

function controller() {
  const instance = new Controller()
  instance.sidebarTarget = { classList: { values: new Set(), toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name) } } }
  instance.backdropTarget = { classList: { values: new Set(), toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name) } } }
  instance.toggleTarget = { setAttribute(name, value) { this[name] = value } }
  return instance
}

test("sidebar alterna o estado móvel e atualiza o botão acessível", () => {
  const instance = controller()
  instance.toggle()
  assert.equal(instance.sidebarTarget.classList.values.has("is-open"), true)
  assert.equal(instance.backdropTarget.classList.values.has("is-visible"), true)
  assert.equal(instance.toggleTarget["aria-expanded"], "true")
  instance.toggle()
  assert.equal(instance.sidebarTarget.classList.values.has("is-open"), false)
  assert.equal(instance.backdropTarget.classList.values.has("is-visible"), false)
  assert.equal(instance.toggleTarget["aria-expanded"], "false")
})

test("Escape fecha a sidebar sem impedir outros atalhos fora dela", () => {
  const instance = controller()
  instance.connect()
  instance.isOpen = true
  let prevented = false
  instance.handleKeydown({ key: "Escape", preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(instance.isOpen, false)
})
