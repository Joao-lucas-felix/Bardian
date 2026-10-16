import { Controller } from "@hotwired/stimulus"
import { addTrack, updateTrack, moveTrack, removeTrack, addRegion, moveRegion, resizeRegion, removeRegion, beatTicks, measureTicks, timelineTicks } from "composition/timeline_state"

/** Coordena a timeline e o formulário sobre um único documento musical versionado. */
export default class extends Controller {
  static targets = ["form", "name", "bpm", "numerator", "denominator", "status", "saveButton", "summary", "scroll", "ruler", "tracks", "empty", "zoomLabel"]
  static values = { url: String }

  /** Carrega o documento persistido; até lá o formulário HTML continua disponível. */
  async connect() {
    this.pixelsPerBeat = 64
    this.revision = 0
    this.selectedRegionId = null
    this.pointerMove = (event) => this.dragMove(event)
    this.pointerUp = () => { this.drag = null }
    window.addEventListener("pointermove", this.pointerMove)
    window.addEventListener("pointerup", this.pointerUp)
    try {
      const response = await this.request(this.urlValue, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error("Não foi possível carregar a timeline. O formulário ainda pode salvar os dados da composição.")
      const snapshot = await response.json()
      this.music = snapshot.document
      this.lockVersion = snapshot.lock_version
      this.statusTarget.textContent = "Tudo salvo."
      this.render()
    } catch (error) {
      this.statusTarget.textContent = error.message
    }
  }

  /** Desfaz listeners globais para não acumular interações após navegar. */
  disconnect() {
    window.removeEventListener("pointermove", this.pointerMove)
    window.removeEventListener("pointerup", this.pointerUp)
  }

  /** Mantém o acesso à rede substituível em testes. */
  request(url, options) { return this.fetch ? this.fetch(url, options) : fetch(url, options) }

  /** Copia metadados válidos do formulário sem tocar nas faixas. */
  changeMetadata() {
    if (!this.music) return
    const before = JSON.stringify([this.music.name, this.music.bpm, this.music.time_signature])
    this.music.name = this.nameTarget.value.trim()
    const bpm = Number(this.bpmTarget.value)
    const numerator = Number(this.numeratorTarget.value)
    const denominator = Number(this.denominatorTarget.value)
    if (Number.isInteger(bpm) && bpm > 0) this.music.bpm = bpm
    if (Number.isInteger(numerator) && numerator > 0) this.music.time_signature.numerator = numerator
    if (Number.isInteger(denominator) && denominator > 0) this.music.time_signature.denominator = denominator
    if (before !== JSON.stringify([this.music.name, this.music.bpm, this.music.time_signature])) {
      this.revision = (this.revision || 0) + 1
      this.markDirty()
      this.render()
    }
  }

  /** Informa que o documento em memória ainda não foi persistido. */
  markDirty() { this.statusTarget.textContent = "Alterações não salvas." }

  /** Envia o documento completo com bloqueio otimista; conflitos preservam o estado local. */
  async save(event) {
    if (!this.music) return
    event.preventDefault()
    if (!this.formTarget.reportValidity()) return
    this.changeMetadata()
    const savedRevision = this.revision || 0
    this.saveButtonTarget.disabled = true
    this.statusTarget.textContent = "Salvando…"
    try {
      const response = await this.request(this.urlValue, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify({ document: this.music, lock_version: this.lockVersion })
      })
      const result = await response.json()
      if (!response.ok) {
        this.statusTarget.textContent = result.error || "Não foi possível salvar."
        return
      }
      if ((this.revision || 0) === savedRevision) this.music = result.document
      this.lockVersion = result.lock_version
      this.formTarget.querySelector('[name="lock_version"]').value = this.lockVersion
      this.statusTarget.textContent = (this.revision || 0) === savedRevision ? "Tudo salvo." : "Alterações novas ainda não salvas."
      this.render()
    } catch (_error) {
      this.statusTarget.textContent = "Falha de conexão. As alterações continuam nesta página."
    } finally {
      this.saveButtonTarget.disabled = false
    }
  }

  /** Cria uma faixa com ID estável e propriedades de reprodução iniciais. */
  addTrack() {
    if (!this.music) return
    this.commit(addTrack(this.music, { id: crypto.randomUUID(), name: `Faixa ${this.music.tracks.length + 1}`, instrument_id: "piano" }))
  }

  /** Ajusta o zoom visual sem modificar os ticks persistidos. */
  zoomIn() { this.changeZoom(16) }
  zoomOut() { this.changeZoom(-16) }
  changeZoom(delta) {
    if (!this.music) return
    this.pixelsPerBeat = Math.max(32, Math.min(128, this.pixelsPerBeat + delta))
    this.render()
  }

  /** Troca o documento após uma operação musical e atualiza a tela. */
  commit(next) { this.music = next; this.revision = (this.revision || 0) + 1; this.markDirty(); this.render() }

  /** Monta controles de forma segura: nomes do usuário entram somente por textContent/value. */
  element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  /** Cria um botão com nome acessível e função local. */
  button(label, action, className = "") {
    const node = this.element("button", className, label)
    node.type = "button"
    node.addEventListener("click", action)
    return node
  }

  /** Desenha a régua e as faixas; largura é derivada dos ticks, nunca gravada. */
  render() {
    if (!this.music) return
    const tracks = this.music.tracks
    const regions = tracks.reduce((count, track) => count + track.regions.length, 0)
    const notes = tracks.reduce((count, track) => count + track.regions.reduce((sum, region) => sum + region.notes.length, 0), 0)
    this.summaryTarget.textContent = `${tracks.length} ${tracks.length === 1 ? "faixa" : "faixas"} · ${regions} ${regions === 1 ? "região" : "regiões"} · ${notes} ${notes === 1 ? "nota" : "notas"}`
    this.emptyTarget.hidden = tracks.length > 0
    this.zoomLabelTarget.textContent = `${Math.round(this.pixelsPerBeat / 64 * 100)}%`
    const measure = measureTicks(this.music)
    const width = timelineTicks(this.music) / beatTicks(this.music) * this.pixelsPerBeat
    this.rulerTarget.replaceChildren()
    const label = this.element("span", "composition-ruler-label", "Faixas / Compassos")
    this.rulerTarget.append(label)
    const marks = this.element("div", "composition-ruler-marks")
    marks.style.width = `${width}px`
    for (let tick = 0; tick < timelineTicks(this.music); tick += measure) {
      const mark = this.element("span", "composition-ruler-mark", String(tick / measure + 1))
      mark.style.width = `${measure / beatTicks(this.music) * this.pixelsPerBeat}px`
      marks.append(mark)
    }
    this.rulerTarget.append(marks)
    this.tracksTarget.replaceChildren(...tracks.map((track, index) => this.trackRow(track, index, width)))
  }

  /** Constrói controles da faixa e sua lane sem deslocar regras para o HTML. */
  trackRow(track, index, width) {
    const row = this.element("div", "composition-track-row")
    const controls = this.element("div", "composition-track-controls")
    const heading = this.element("div", "composition-track-heading")
    const name = this.element("input", "composition-track-name")
    name.type = "text"; name.value = track.name; name.maxLength = 120
    name.setAttribute("aria-label", `Nome da faixa ${index + 1}`)
    name.addEventListener("change", () => this.commit(updateTrack(this.music, track.id, { name: name.value.trim() })))
    heading.append(name)
    controls.append(heading)
    const instrument = this.element("select", "composition-track-instrument")
    instrument.setAttribute("aria-label", `Instrumento de ${track.name}`)
    for (const [id, label] of [["piano", "Piano"], ["strings", "Cordas"], ["drums", "Bateria"]]) {
      const option = this.element("option", "", label); option.value = id; instrument.append(option)
    }
    if (!["piano", "strings", "drums"].includes(track.instrument_id)) {
      const option = this.element("option", "", track.instrument_id); option.value = track.instrument_id; instrument.append(option)
    }
    instrument.value = track.instrument_id
    instrument.addEventListener("change", () => this.commit(updateTrack(this.music, track.id, { instrument_id: instrument.value })))
    controls.append(instrument)
    const volume = this.element("input", "composition-track-volume")
    volume.type = "range"; volume.min = "0"; volume.max = "100"; volume.value = String(Math.round(track.volume * 100))
    volume.setAttribute("aria-label", `Volume de ${track.name}`)
    volume.addEventListener("change", () => this.commit(updateTrack(this.music, track.id, { volume: Number(volume.value) / 100 })))
    controls.append(volume)
    const switches = this.element("div", "composition-track-switches")
    for (const [key, label] of [["mute", "Silenciar"], ["solo", "Solo"]]) {
      const wrapper = this.element("label", "composition-track-switch")
      const input = this.element("input"); input.type = "checkbox"; input.checked = track[key]
      input.addEventListener("change", () => this.commit(updateTrack(this.music, track.id, { [key]: input.checked })))
      wrapper.append(input, this.element("span", "", label)); switches.append(wrapper)
    }
    controls.append(switches)
    const actions = this.element("div", "composition-track-actions")
    actions.append(
      this.button("+ Região", () => this.appendRegion(track), "composition-mini-button"),
      this.button("↑", () => this.commit(moveTrack(this.music, track.id, -1)), "composition-mini-button"),
      this.button("↓", () => this.commit(moveTrack(this.music, track.id, 1)), "composition-mini-button"),
      this.button("Excluir faixa", () => { if (window.confirm(`Excluir ${track.name} e suas regiões?`)) this.commit(removeTrack(this.music, track.id)) }, "composition-mini-button composition-mini-danger")
    )
    actions.children[1].disabled = index === 0
    actions.children[2].disabled = index === this.music.tracks.length - 1
    controls.append(actions)
    const lane = this.element("div", "composition-track-lane")
    lane.style.width = `${width}px`
    lane.style.setProperty("--beat-width", `${this.pixelsPerBeat}px`)
    lane.style.setProperty("--measure-width", `${measureTicks(this.music) / beatTicks(this.music) * this.pixelsPerBeat}px`)
    lane.addEventListener("dblclick", (event) => {
      if (event.target !== lane) return
      const tick = (event.clientX - lane.getBoundingClientRect().left) / this.pixelsPerBeat * beatTicks(this.music)
      this.appendRegion(track, tick)
    })
    for (const region of track.regions) lane.append(this.regionNode(track, region))
    row.append(controls, lane)
    return row
  }

  /** Acrescenta uma região de um compasso após a última, ou na posição escolhida. */
  appendRegion(track, requestedTick) {
    const end = track.regions.reduce((max, region) => Math.max(max, region.start_tick + region.duration_ticks), 0)
    this.commit(addRegion(this.music, track.id, { id: crypto.randomUUID(), start_tick: requestedTick ?? end,
      duration_ticks: measureTicks(this.music), notes: [] }))
  }

  /** Região selecionável por mouse e teclado, com alça própria de duração. */
  regionNode(track, region) {
    const node = this.element("div", "composition-region")
    node.dataset.regionId = region.id
    node.tabIndex = 0; node.setAttribute("role", "button")
    node.setAttribute("aria-label", `Região de ${track.name}, início ${region.start_tick} ticks, duração ${region.duration_ticks} ticks`)
    node.setAttribute("aria-pressed", String(this.selectedRegionId === region.id))
    node.style.left = `${region.start_tick / beatTicks(this.music) * this.pixelsPerBeat}px`
    node.style.width = `${region.duration_ticks / beatTicks(this.music) * this.pixelsPerBeat}px`
    node.append(this.element("span", "composition-region-title", `${region.notes.length} ${region.notes.length === 1 ? "nota" : "notas"}`))
    const grip = this.element("span", "composition-region-grip")
    grip.setAttribute("aria-hidden", "true")
    grip.addEventListener("pointerdown", (event) => { event.stopPropagation(); this.startDrag(event, track, region, "resize") })
    node.append(grip)
    node.addEventListener("pointerdown", (event) => this.startDrag(event, track, region, "move"))
    node.addEventListener("click", () => { this.selectedRegionId = region.id; this.render() })
    node.addEventListener("keydown", (event) => this.regionKey(event, track, region))
    return node
  }

  /** Guarda o ponto inicial; os listeners na janela sobrevivem ao redesenho da lane. */
  startDrag(event, track, region, mode) {
    if (event.button !== 0) return
    event.preventDefault()
    this.selectedRegionId = region.id
    this.drag = { trackId: track.id, regionId: region.id, mode, x: event.clientX,
      start: region.start_tick, duration: region.duration_ticks }
    this.render()
  }

  /** Converte deslocamento em ticks com snap musical antes de alterar o documento. */
  dragMove(event) {
    if (!this.drag || !this.music) return
    const delta = (event.clientX - this.drag.x) / this.pixelsPerBeat * beatTicks(this.music)
    const { trackId, regionId, mode, start, duration } = this.drag
    const next = mode === "resize" ? resizeRegion(this.music, trackId, regionId, duration + delta) :
      moveRegion(this.music, trackId, regionId, start + delta)
    const old = this.music.tracks.find((track) => track.id === trackId).regions.find((region) => region.id === regionId)
    const changed = mode === "resize" ? next.tracks.find((track) => track.id === trackId).regions.find((region) => region.id === regionId).duration_ticks !== old.duration_ticks :
      next.tracks.find((track) => track.id === trackId).regions.find((region) => region.id === regionId).start_tick !== old.start_tick
    if (changed) this.commit(next)
  }

  /** Oferece alternativa acessível ao arraste para mover, estender ou remover. */
  regionKey(event, track, region) {
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault()
      const step = event.key === "ArrowRight" ? beatTicks(this.music) : -beatTicks(this.music)
      this.commit(event.shiftKey ? resizeRegion(this.music, track.id, region.id, region.duration_ticks + step) :
        moveRegion(this.music, track.id, region.id, region.start_tick + step))
      this.tracksTarget.querySelector(`[data-region-id="${region.id}"]`)?.focus()
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      if (window.confirm("Excluir esta região e suas notas?")) this.commit(removeRegion(this.music, track.id, region.id))
    }
  }
}
