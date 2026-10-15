import { Controller } from "@hotwired/stimulus"

/**
 * Alterna o tema visual global e preserva a escolha no navegador.
 * A preferência do sistema é usada apenas quando o usuário ainda não escolheu um tema.
 */
export default class extends Controller {
  static targets = ["toggle", "label"]

  /** Aplica a preferência salva ou a preferência escura do sistema. @returns {void} */
  connect() {
    this.documentElement = document.documentElement
    this.storage = window.localStorage
    const storedTheme = this.storage.getItem("bardian-theme")
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    this.setTheme(storedTheme || systemTheme, false)
  }

  /** Alterna entre claro e escuro após uma ação explícita. @returns {void} */
  toggle() {
    const nextTheme = this.documentElement.dataset.theme === "dark" ? "light" : "dark"
    this.setTheme(nextTheme)
  }

  /**
   * Atualiza o atributo de tema e o estado acessível do botão.
   * @param {"light"|"dark"} theme Tema a aplicar.
   * @param {boolean} persist Indica se a escolha deve ser salva.
   * @returns {void}
   */
  setTheme(theme, persist = true) {
    this.documentElement.dataset.theme = theme
    if (persist) this.storage.setItem("bardian-theme", theme)
    if (!this.hasToggleTarget) return

    const dark = theme === "dark"
    this.toggleTarget.setAttribute("aria-pressed", String(dark))
    this.toggleTarget.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro")
    this.labelTarget.textContent = dark ? "Tema claro" : "Tema escuro"
  }
}
