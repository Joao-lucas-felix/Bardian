import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

// Carrega o controller real sem inicializar Stimulus ou o navegador completo.
const controllerPath = new URL("../../app/javascript/controllers/theme_controller.js", import.meta.url)
const source = readFileSync(controllerPath, "utf8")
  .replace(/^import .*$/gm, "")
  .replace("export default class extends Controller", "class ThemeController extends Controller")

const ThemeController = vm.runInNewContext(`${source}\nThemeController`, {
  Controller: class {}
})

test("alterna o tema escuro e persiste a preferência", () => {
  const attributes = new Map()
  const storage = new Map()
  const instance = Object.create(ThemeController.prototype)
  instance.documentElement = { dataset: {} }
  instance.hasToggleTarget = true
  instance.labelTarget = { textContent: "" }
  instance.toggleTarget = {
    setAttribute: (name, value) => attributes.set(name, value),
    textContent: ""
  }
  instance.storage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  }
  instance.setTheme("dark")

  assert.equal(storage.get("bardian-theme"), "dark")
  assert.equal(attributes.get("aria-pressed"), "true")
  assert.equal(instance.labelTarget.textContent, "Tema claro")
})
