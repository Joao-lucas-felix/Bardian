import { Controller } from "@hotwired/stimulus"

/** Controla apenas a animação decorativa; não produz áudio nem altera dados musicais. */
export default class extends Controller {
  static targets = ["band", "button", "cover"]

  /** Inicializa a preferência de pausa e acompanha mudanças de movimento reduzido. */
  connect() {
    this.paused = false
    this.plucks = new Map()
    this.motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
    this.onPreferenceChange = () => this.refresh()
    this.motionPreference.addEventListener("change", this.onPreferenceChange)
    this.buttonTarget.hidden = false
    this.refresh()
  }

  /** Remove o observador ao sair da página, inclusive durante navegação Turbo. */
  disconnect() {
    this.cancelPlucks()
    this.motionPreference.removeEventListener("change", this.onPreferenceChange)
    this.bandTarget.dataset.playing = "false"
    this.buttonTarget.hidden = true
  }

  /** Alterna a escolha do visitante sem reiniciar a posição das notas. */
  toggle() {
    this.paused = !this.paused
    this.buttonTarget.textContent = this.paused ? "Retomar animação" : "Pausar animação"
    this.refresh()
  }

  /**
   * Atualiza o estado após rolagem, redimensionamento ou mudança de visibilidade.
   * Considera a segunda cena sobreposta à abertura sticky, além dos limites da tela.
   * Não recebe parâmetros nem retorna valor; atualiza somente um atributo de estado.
   */
  refresh() {
    const band = this.bandTarget.getBoundingClientRect()
    const cover = this.coverTarget.getBoundingClientRect()
    const visible = band.bottom > 0 && band.top < Math.min(window.innerHeight, cover.top)
    this.bandTarget.dataset.playing = String(
      visible && !document.hidden && !this.paused && !this.motionPreference.matches
    )
    if (this.bandTarget.dataset.playing !== "true") this.cancelPlucks()
  }

  /**
   * Localiza a corda sob o ponteiro, mesmo quando o texto está à frente do SVG.
   * Converte coordenadas da tela para cada corda, respeitando a rotação de 45 graus.
   * @param {PointerEvent} event Movimento na primeira cena; toque não dedilha.
   * @returns {void} Anima apenas ao entrar em uma corda diferente.
   */
  pointStrings(event) {
    if (this.bandTarget.dataset.playing !== "true") return
    if (event.pointerType === "touch") return

    const point = new DOMPoint(event.clientX, event.clientY)
    let nearest = null
    let distance = 6
    this.bandTarget.querySelectorAll(".story-strings g").forEach(group => {
      const matrix = group.getScreenCTM()
      if (!matrix) return
      const local = point.matrixTransform(matrix.inverse())
      // As pontas desvanecidas ficam fora da região de dedilhado.
      if (local.x < 140 || local.x > 1260 || Math.abs(local.y) >= distance) return
      nearest = group.querySelector(".instrument-string")
      distance = Math.abs(local.y)
    })
    if (nearest && nearest !== this.hoveredString) this.pluck(nearest)
    this.hoveredString = nearest
  }

  /** Libera a referência ao sair da cena para permitir um novo dedilhado ao voltar. */
  leaveStrings() {
    this.hoveredString = null
  }

  /**
   * Produz uma oscilação curta, sem áudio, substituindo o dedilhado anterior.
   * @param {SVGPathElement} string Traço da corda selecionada pelo ponteiro.
   * @returns {void}
   */
  pluck(string) {
    this.plucks.get(string)?.cancel()

    const animation = string.animate(
      // A escala mínima preserva o traço da corda antes e depois do dedilhado.
      [0.01, 1, -0.7, 0.45, -0.25, 0.1, 0.01].map(value => ({
        transform: `scaleY(${value})`
      })),
      { duration: 700, easing: "linear" }
    )

    this.plucks.set(string, animation)
    animation.onfinish = () => this.plucks.delete(string)
  }

  /** Encerra os dedilhados do ponteiro sem alterar a sequência automática. */
  cancelPlucks() {
    this.plucks.forEach(animation => animation.cancel())
    this.plucks.clear()
    this.hoveredString = null
  }
}
