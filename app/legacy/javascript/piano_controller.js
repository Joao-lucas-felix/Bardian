import { Controller } from "@hotwired/stimulus"
import * as Tone from "tone"

/**
 * Reproduz as alturas fornecidas pelas teclas da apresentação.
 * Usa um sampler Salamander por piano, sem alterar o domínio musical Ruby.
 */
export default class extends Controller {
  static targets = ["key", "status"]

  /** Carrega Lá4 e bloqueia a execução até o sample ficar pronto. @returns {void} */
  connect() {
    this.highlights = new Map()
    this.setReady(false)
    this.statusTarget.textContent = "Carregando piano…"

    const sampler = new Tone.Sampler({
      urls: { A4: "A4.mp3" },
      baseUrl: "/audio/salamander/",
      release: 0.5,
      volume: -12,
      onload: () => {
        // Uma navegação pode descartar o instrumento antes de concluir a carga.
        if (this.sampler !== sampler) return
        this.setReady(true)
        this.statusTarget.textContent = "Experimente as teclas — clique, toque ou use Tab e Enter."
      },
      onerror: () => {
        if (this.sampler !== sampler) return
        this.setReady(false)
        this.statusTarget.textContent = "Não foi possível carregar o piano. Recarregue a página para tentar novamente."
      }
    }).toDestination()

    this.sampler = sampler
  }

  /**
   * Informa às tecnologias assistivas se as teclas podem produzir som.
   * @param {boolean} ready Indica que o sample está disponível.
   * @returns {void}
   */
  setReady(ready) {
    this.keyTargets.forEach((key) => key.setAttribute("aria-disabled", String(!ready)))
  }

  /**
   * Toca a nota recebida do ERB por 0,5 segundo, seguida pelo release do sampler.
   * Aceita clique/toque e Enter/Espaço; segurar uma tecla não repete a execução.
   * @param {Event} event Evento Stimulus com params.note e a tecla em currentTarget.
   * @returns {Promise<void>} Conclui após enviar o comando de áudio ou informar erro.
   */
  async play(event) {
    if (event.type === "keydown") {
      event.preventDefault()
      if (event.repeat) return
    }

    const key = event.currentTarget
    const sampler = this.sampler
    if (!sampler?.loaded || key.getAttribute("aria-disabled") === "true") return

    try {
      // A primeira interação libera o contexto de áudio do navegador.
      await Tone.start()
      if (this.sampler !== sampler) return

      // O sampler transpõe A4 para a altura solicitada, inclusive os sustenidos.
      sampler.triggerAttackRelease(event.params.note, 0.5)
      this.highlight(key)
      this.statusTarget.textContent = `${key.getAttribute("aria-label")} — experimente outra nota.`
    } catch {
      if (this.sampler !== sampler) return
      this.statusTarget.textContent = "Não foi possível iniciar o áudio. Toque em uma tecla para tentar novamente."
    }
  }

  /**
   * Mantém o destaque pelo tempo da nota e renova o prazo em cliques repetidos.
   * @param {SVGGElement} key Grupo SVG que representa a tecla acionada.
   * @returns {void}
   */
  highlight(key) {
    clearTimeout(this.highlights.get(key))
    key.classList.add("is-playing")
    this.highlights.set(key, setTimeout(() => {
      key.classList.remove("is-playing")
      this.highlights.delete(key)
    }, 500))
  }

  /** Libera áudio e temporizadores ao sair, preservando o contexto Tone compartilhado. @returns {void} */
  disconnect() {
    this.highlights.forEach((timer, key) => {
      clearTimeout(timer)
      key.classList.remove("is-playing")
    })
    this.highlights.clear()
    this.setReady(false)
    this.sampler?.dispose()
    this.sampler = null
  }
}
