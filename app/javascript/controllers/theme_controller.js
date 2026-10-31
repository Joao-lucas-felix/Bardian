import { Controller } from "@hotwired/stimulus"

/**
 * Alterna o tema visual global e preserva a escolha no navegador.
 * O tema de estúdio escuro é o padrão; uma escolha explícita anterior tem prioridade.
 */
export default class extends Controller {
  static targets = ["toggle", "label"]

  /** Aplica a preferência salva, tolerando navegadores que bloqueiam armazenamento. @returns {void} */
  connect() {
    this.documentElement = document.documentElement
    let storedTheme
    try {
      this.storage = window.localStorage
      storedTheme = this.storage.getItem("bardian-theme")
    } catch {
      this.storage = null
    }
    this.setTheme(storedTheme === "light" ? "light" : "dark", false)
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
    // A escolha continua funcionando na sessão mesmo quando a persistência é bloqueada.
    if (persist) {
      try { this.storage?.setItem("bardian-theme", theme) } catch { /* Preferência aplicada apenas nesta página. */ }
    }
    if (!this.hasToggleTarget) return

    const dark = theme === "dark"
    this.toggleTarget.setAttribute("aria-pressed", String(dark))
    this.toggleTarget.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro")
    this.labelTarget.textContent = dark ? "Tema claro" : "Tema escuro"
  }
}
