import { Controller } from "@hotwired/stimulus"

/** Mantém um viajante no mapa; salva visitas sem alterar conclusões. */
export default class extends Controller {
  static targets = ["traveller", "stop", "message"]
  static values = { last: String }

  /** Restaura a posição conhecida e mantém links acessíveis na ausência de JavaScript. */
  connect() {
    this.element.classList.add("is-interactive")
    this.position = this.origin()
    this.current = this.stopTargets.find(stop => stop.dataset.slug && stop.dataset.slug === this.lastValue)
    if (this.current) this.position = this.point(this.current, true)
    this.place(this.position)
    this.stopTargets.forEach(stop => { stop.querySelector("[data-summary]").close() })
    if (this.current) this.reveal(this.current)
    if (window.ResizeObserver) {
      this.resizeObserver = new window.ResizeObserver(() => {
        this.animation?.cancel()
        this.position = this.current ? this.point(this.current, true) : this.origin()
        this.place(this.position)
      })
      this.resizeObserver.observe(this.element)
    }
  }

  /** Mantém o início da caminhada na mesma escala do SVG de entrada (400 × 100). */
  origin() {
    return { x: this.element.clientWidth / 2, y: this.element.clientWidth * 48 / 400 }
  }

  /** Calcula um ponto relativo ao mapa usando coordenadas reais do layout responsivo. */
  point(stop, door = false) {
    const map = this.element.getBoundingClientRect(), rect = stop.getBoundingClientRect()
    return { x: (door ? (this.stopTargets.indexOf(stop) % 2 ? .25 : .75) : .5) * rect.width, y: rect.top - map.top + rect.height * (door ? 132 : 140) / 240 }
  }

  /** Posiciona os pés do personagem no ponto da estrada. */
  place(point) {
    this.travellerTarget.style.left = `${point.x}px`
    this.travellerTarget.style.top = `${point.y}px`
  }

  /** Caminha pelas curvas entre as paradas; cliques concorrentes são ignorados até salvar. */
  async select(event) {
    if (this.busy) return
    this.busy = true
    this.messageTarget.textContent = ""
    this.close()
    if (this.current) this.position = this.point(this.current, true)
    const stop = event.currentTarget.closest("[data-slug]")
    const destination = this.point(stop), door = this.point(stop, true)
    const points = [this.position]
    if (this.current) {
      const entrance = this.point(this.current)
      points.push({ x: this.position.x, y: entrance.y }, entrance)
    }
    const start = points[points.length - 1].y
    const bends = []
    this.stopTargets.forEach((item, index) => {
      const center = this.point(item).y
      const scale = item.getBoundingClientRect().height / 240
      ;[[center - 140 * scale, .5], [center - 120 * scale, .5], [center - 70 * scale, index % 2 ? .5875 : .4125], [center, .5], [center + 55 * scale, index % 2 ? .4 : .6], [center + 80 * scale, .5], [center + 100 * scale, .5]].forEach(([y, ratio]) => {
        if (y > Math.min(start, destination.y) && y < Math.max(start, destination.y)) bends.push({ x: ratio * this.element.clientWidth, y })
      })
    })
    bends.sort((a, b) => start > destination.y ? b.y - a.y : a.y - b.y)
    points.push(...bends, destination, { x: door.x, y: destination.y }, door)
    try {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && this.travellerTarget.animate) {
        const route = this.walkingRoute(points)
        this.animation = this.travellerTarget.animate(route.frames, { duration: route.duration, easing: "linear" })
        await this.animation.finished
      }
      if (!this.element.isConnected) return
      this.position = door
      this.place(door)
      this.current = stop
      stop.querySelector("[data-visit-message]").textContent = ""
      this.travellerTarget.hidden = true
      stop.querySelector("[data-summary]").showModal()
      stop.querySelector("button").setAttribute("aria-expanded", "true")
      stop.querySelector("[data-summary]").focus({ preventScroll: true })
      if (stop.dataset.visitUrl) await this.save(stop.dataset.visitUrl)
    } catch (error) {
      if (error.name !== "AbortError") this.messageTarget.textContent = "Não foi possível completar a caminhada. Tente novamente."
    } finally { this.busy = false }
  }

  /**
   * Recebe pontos em pixels e retorna quadros com tempo proporcional à distância.
   * Arredonda cada canto com uma Bézier curta, limitada à largura da estrada;
   * preserva partida e chegada e descarta pontos repetidos para evitar pausas.
   */
  walkingRoute(points) {
    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
    const path = points.filter((point, index) => index === 0 || distance(points[index - 1], point) > .01)
    const scale = this.element.clientWidth / 400
    const smooth = [path[0]]
    for (let index = 1; index < path.length - 1; index++) {
      const before = path[index - 1], corner = path[index], after = path[index + 1]
      const incoming = distance(before, corner), outgoing = distance(corner, after)
      const radius = Math.min(8 * scale, incoming / 3, outgoing / 3)
      const entry = { x: corner.x + (before.x - corner.x) * radius / incoming, y: corner.y + (before.y - corner.y) * radius / incoming }
      const exit = { x: corner.x + (after.x - corner.x) * radius / outgoing, y: corner.y + (after.y - corner.y) * radius / outgoing }
      smooth.push(entry)
      for (let step = 1; step <= 8; step++) {
        const t = step / 8, u = 1 - t
        smooth.push({ x: u * u * entry.x + 2 * u * t * corner.x + t * t * exit.x,
          y: u * u * entry.y + 2 * u * t * corner.y + t * t * exit.y })
      }
    }
    if (path.length > 1) smooth.push(path[path.length - 1])
    const lengths = [0]
    for (let index = 1; index < smooth.length; index++) lengths.push(lengths[index - 1] + distance(smooth[index - 1], smooth[index]))
    const total = lengths[lengths.length - 1]
    return {
      frames: smooth.map((point, index) => ({ left: `${point.x}px`, top: `${point.y}px`, offset: total ? lengths[index] / total : 1 })),
      // Cerca de 330 unidades do cenário por segundo; viagens longas terminam em até 2 s.
      duration: total ? Math.min(2000, total / scale * 3) : 0
    }
  }

  /** Enquadra um elemento deslocando somente a região rolável do mapa. */
  reveal(element) {
    const viewport = this.element.parentElement
    if (!viewport) return
    const box = viewport.getBoundingClientRect(), target = element.getBoundingClientRect()
    viewport.scrollTop += target.top - box.top - Math.max(16, (viewport.clientHeight - target.height) / 2)
  }

  /** Salva a chegada com proteção CSRF; falhas não impedem abrir a aula. */
  async save(url) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "", Accept: "application/json" } })
      if (!response.ok || response.redirected) throw new Error("visit")
    } catch {
      const message = "A posição não foi salva. Você ainda pode entrar na aula."
      this.messageTarget.textContent = message
      if (this.current) this.current.querySelector("[data-visit-message]").textContent = message
    }
  }

  /** Fecha o resumo e devolve o personagem à porta e o foco ao seletor. */
  close(event) {
    event?.preventDefault?.()
    this.stopTargets.forEach(stop => {
      stop.querySelector("[data-summary]").close()
      stop.querySelector("button").setAttribute("aria-expanded", "false")
    })
    this.travellerTarget.hidden = false
    if (event && this.current) this.current.querySelector("button").focus()
  }

  /** Interrompe animações quando Turbo remove o mapa. */
  disconnect() {
    this.animation?.cancel()
    this.resizeObserver?.disconnect()
    this.stopTargets.forEach(stop => stop.querySelector("[data-summary]").close())
  }
}
