import { Controller } from "@hotwired/stimulus"

/** Mantém alertas legíveis e remove avisos de sucesso após um tempo curto. */
export default class extends Controller {
  static values = { autoDismiss: Boolean }

  /** Programa o fechamento apenas dos avisos transitórios. */
  connect() {
    if (this.autoDismissValue) this.timeout = window.setTimeout(() => this.dismiss(), 5000)
  }

  /** Evita que o temporizador de uma página antiga afete outra navegação. */
  disconnect() {
    if (this.timeout) window.clearTimeout(this.timeout)
  }

  /** Fecha o aviso pelo botão ou pelo temporizador, sem alterar o flash do servidor. */
  dismiss() {
    this.element.remove()
  }
}
