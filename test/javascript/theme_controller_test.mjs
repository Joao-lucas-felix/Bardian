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

/** Conecta o controller real a uma preferência simulada, sem efeitos no navegador. */
function connectTheme(saved, unavailable = false) {
  const root = { dataset: {} }
  const Controller = vm.runInNewContext(`${source}\nThemeController`, {
    Controller: class {}, document: { documentElement: root },
    window: { matchMedia: () => ({ matches: false }), get localStorage() {
      if (unavailable) throw new Error("Armazenamento bloqueado")
      return { getItem: () => saved, setItem() {} }
    } }
  })
  const controller = new Controller()
  controller.connect()
  return { controller, root }
}

test("usa escuro por padrão e preserva preferência clara explícita", () => {
  assert.equal(connectTheme(null).root.dataset.theme, "dark")
  assert.equal(connectTheme("light").root.dataset.theme, "light")
  assert.equal(connectTheme("invalid").root.dataset.theme, "dark")
})

test("permite alternar tema mesmo com armazenamento bloqueado", () => {
  const { controller, root } = connectTheme(null, true)
  assert.equal(root.dataset.theme, "dark")
  controller.toggle()
  assert.equal(root.dataset.theme, "light")
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
