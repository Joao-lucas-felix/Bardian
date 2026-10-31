import { Controller } from "@hotwired/stimulus"

/** Controla a sidebar global e sua versão móvel sem alterar o destino das rotas. */
export default class extends Controller {
  static targets = ["sidebar", "backdrop", "toggle"]

  /** Registra o Escape e inicia a navegação fechada em telas pequenas. @returns {void} */
  connect() {
    this.isOpen = false
    this.handleKeydown = (event) => {
      if (event.key === "Escape" && this.isOpen) {
        event.preventDefault()
        this.close()
      }
    }
    document.addEventListener("keydown", this.handleKeydown)
    this.updateState()
  }

  /** Remove o listener global quando a navegação sai da página. @returns {void} */
  disconnect() {
    document.removeEventListener("keydown", this.handleKeydown)
    document.body.classList.remove("navigation-open")
  }

  /** Alterna a sidebar móvel. @returns {void} */
  toggle() {
    this.isOpen = !this.isOpen
    this.updateState()
  }

  /** Fecha a navegação móvel após clique no fundo ou em uma rota. @returns {void} */
  close() {
    this.isOpen = false
    this.updateState()
  }

  /** Mantém classes, foco e semântica sincronizados com o estado visual. @returns {void} */
  updateState() {
    this.sidebarTarget.classList.toggle("is-open", this.isOpen)
    this.backdropTarget.classList.toggle("is-visible", this.isOpen)
    this.toggleTarget.setAttribute("aria-expanded", String(this.isOpen))
    this.toggleTarget.setAttribute("aria-label", this.isOpen ? "Fechar navegação" : "Abrir navegação")
    document.body.classList.toggle("navigation-open", this.isOpen)
  }
}
