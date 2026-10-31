import { Controller } from "@hotwired/stimulus"
import * as Tone from "tone"

/**
 * Valida a reprodução de Lá4 com um sample de piano Salamander.
 * Mantém um sampler por demonstração e libera seus recursos ao sair.
 */
export default class extends Controller {
  static targets = ["button", "status"]

  /**
   * Carrega o sample sem iniciar a reprodução.
   * Habilita o botão quando o piano estiver pronto e informa falhas.
   * @returns {void}
   */
  connect() {
    this.buttonTarget.disabled = true
    this.statusTarget.textContent = "Carregando piano…"

    const sampler = new Tone.Sampler({
      urls: { A4: "A4.mp3" },
      baseUrl: "/audio/salamander/",
      release: 0.5,
      volume: -12,
      onload: () => {
        // Ignora respostas de um sampler liberado após navegação.
        if (this.sampler !== sampler) return

        this.buttonTarget.disabled = false
        this.statusTarget.textContent = "Piano pronto."
      },
      onerror: () => {
        if (this.sampler !== sampler) return

        this.statusTarget.textContent =
          "Não foi possível carregar o piano. Recarregue a página para tentar novamente."
      }
    }).toDestination()

    this.sampler = sampler
  }

  /**
   * Ativa o áudio após o clique e toca Lá4 durante meio segundo,
   * seguido pelo decaimento configurado no sampler.
   * Captura falhas de inicialização e permite uma nova tentativa.
   * @returns {Promise<void>}
   */
  async play() {
    const sampler = this.sampler
    if (!sampler?.loaded || this.buttonTarget.disabled) return

    this.buttonTarget.disabled = true

    try {
      await Tone.start()

      // A navegação pode ter ocorrido durante a ativação do áudio.
      if (this.sampler !== sampler) return

      sampler.releaseAll()
      sampler.triggerAttackRelease("A4", 0.5)
      this.statusTarget.textContent = "Lá4 reproduzido."
    } catch {
      if (this.sampler === sampler) {
        this.statusTarget.textContent =
          "Não foi possível iniciar o áudio. Tente novamente."
      }
    } finally {
      if (this.sampler === sampler) {
        this.buttonTarget.disabled = false
      }
    }
  }

  /**
   * Libera o sampler ao remover a demonstração da página.
   * Preserva o contexto de áudio compartilhado do Tone.js.
   * @returns {void}
   */
  disconnect() {
    this.sampler?.dispose()
    this.sampler = null
  }
}
