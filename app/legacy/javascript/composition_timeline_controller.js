import { Controller } from "@hotwired/stimulus"
import { addTrack, updateTrack, moveTrack, removeTrack, addRegion, moveRegion, resizeRegion, removeRegion, beatTicks, measureTicks, timelineTicks, setLoopRange } from "composition/timeline_state"
import { addSuggestedChord, newNoteId, regionFor, replaceRegionNotes, toEditorNotes } from "composition/region_notes"
import { createHistory, record, redo, undo } from "composition/note_history"
import { loopRange } from "composition/playback_events"
import { createCompositionAudio } from "audio/composition_audio"
import { createCompositionTransport } from "audio/composition_transport"
import { INSTRUMENT_CATALOG } from "audio/phrase_instruments"

/** Coordena a timeline e o formulário sobre um único documento musical versionado. */
export default class extends Controller {
  static targets = ["form", "name", "bpm", "numerator", "denominator", "tonic", "mode", "status", "saveButton", "summary", "scroll", "ruler", "tracks", "empty", "zoomLabel", "regionEditor", "expandEditorButton", "guidanceText", "assistancePanel", "assistanceStatus", "assistanceField", "assistanceSuggestions", "transportStatus", "playhead", "playToggle", "playToggleLabel", "loopStart", "loopEnd", "loopStartHandle", "loopEndHandle", "loopButton"]
  static values = { url: String, assistanceUrl: String }

  /** Carrega o documento persistido; até lá o formulário HTML continua disponível. */
  async connect() {
    this.disconnected = false
    this.pixelsPerBeat = 64
    this.revision = 0
    this.selectedRegionId = null
    this.selectedTrackId = null
    this.dirty = false
    this.noteHistories = new Map()
    this.pointerMove = (event) => this.dragMove(event)
    this.pointerUp = () => { this.drag = null; this.markerDrag = null }
    window.addEventListener("pointermove", this.pointerMove)
    window.addEventListener("pointerup", this.pointerUp)
    this.editorEscapeHandler = (event) => this.closeExpandedOnEscape(event)
    this.beforeUnloadHandler = (event) => {
      if (!this.dirty) return
      event.preventDefault()
      event.returnValue = ""
    }
    if (this.hasRegionEditorTarget) this.regionEditorTarget.addEventListener("keydown", this.editorEscapeHandler, true)
    window.addEventListener("beforeunload", this.beforeUnloadHandler)
    try {
      const response = await this.request(this.urlValue, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error("Não foi possível carregar a timeline. O formulário ainda pode salvar os dados da composição.")
      const snapshot = await response.json()
      if (this.disconnected) return
      this.music = snapshot.document
      this.lockVersion = snapshot.lock_version
      this.autosaveEnabled = true
      this.transport = createCompositionTransport({ audio: createCompositionAudio(), onState: (state) => this.onTransportState(state) })
      this.statusTarget.textContent = "Tudo salvo."
      this.render()
      this.refreshAssistance()
    } catch (error) {
      this.statusTarget.textContent = error.message
    }
  }

  /** Desfaz listeners globais para não acumular interações após navegar. */
  disconnect() {
    this.disconnected = true
    this.closeRegionEditor({ restoreFocus: false })
    if (this.hasRegionEditorTarget) this.regionEditorTarget.removeEventListener("keydown", this.editorEscapeHandler, true)
    window.removeEventListener("beforeunload", this.beforeUnloadHandler)
    this.activePianoRoll()?.stop()
    this.transport?.dispose()
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer)
    window.removeEventListener("pointermove", this.pointerMove)
    window.removeEventListener("pointerup", this.pointerUp)
  }

  /** Mantém o acesso à rede substituível em testes. */
  request(url, options) { return this.fetch ? this.fetch(url, options) : fetch(url, options) }

  /** Copia metadados válidos do formulário sem tocar nas faixas. */
  changeMetadata() {
    if (!this.music) return
    const before = JSON.stringify([this.music.name, this.music.bpm, this.music.time_signature, this.music.context])
    // O transporte conserva o documento anterior para ancorar corretamente mudanças de BPM.
    this.music = { ...this.music, time_signature: { ...this.music.time_signature } }
    this.music.name = this.nameTarget.value.trim()
    const bpm = Number(this.bpmTarget.value)
    const numerator = Number(this.numeratorTarget.value)
    const denominator = Number(this.denominatorTarget.value)
    if (Number.isInteger(bpm) && bpm > 0) this.music.bpm = bpm
    if (Number.isInteger(numerator) && numerator > 0) this.music.time_signature.numerator = numerator
    if (Number.isInteger(denominator) && denominator > 0) this.music.time_signature.denominator = denominator
    if (this.hasTonicTarget && this.hasModeTarget) {
      this.music.context = this.tonicTarget.value ? { tonic: this.tonicTarget.value, mode: this.modeTarget.value } : undefined
      if (!this.music.context) delete this.music.context
    }
    if (before !== JSON.stringify([this.music.name, this.music.bpm, this.music.time_signature, this.music.context])) {
      this.revision = (this.revision || 0) + 1
      this.markDirty()
      this.transport?.update(this.music)
      this.render()
      this.refreshAssistance()
    }
  }

  /** Informa que o documento em memória ainda não foi persistido e agenda autosave. */
  markDirty() {
    this.dirty = true
    this.statusTarget.textContent = "Alterações não salvas."
    this.scheduleAutosave()
  }

  /** Aguarda uma pausa curta para salvar agrupamentos de edições sem bombardear o endpoint. */
  scheduleAutosave() {
    if (!this.autosaveEnabled || !this.music || this.saveInFlight) return
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer)
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null
      this.save({ preventDefault() {} })
    }, 1000)
  }

  /** Envia o documento completo com bloqueio otimista; conflitos preservam o estado local. */
  async save(event) {
    if (!this.music) return
    event.preventDefault()
    if (this.saveInFlight) return
    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer)
      this.autosaveTimer = null
    }
    if (!this.formTarget.reportValidity()) return
    this.changeMetadata()
    const savedRevision = this.revision || 0
    this.saveInFlight = true
    let persisted = false
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
      if ((this.revision || 0) === savedRevision) {
        this.music = result.document
        this.transport?.update(this.music)
      }
      persisted = true
      this.lockVersion = result.lock_version
      this.formTarget.querySelector('[name="lock_version"]').value = this.lockVersion
      const current = (this.revision || 0) === savedRevision
      this.dirty = !current
      this.statusTarget.textContent = current ? "Tudo salvo." : "Alterações novas ainda não salvas."
      this.render()
    } catch (_error) {
      this.statusTarget.textContent = "Falha de conexão. As alterações continuam nesta página."
    } finally {
      this.saveInFlight = false
      if (persisted && (this.revision || 0) !== savedRevision) this.scheduleAutosave()
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
  commit(next) {
    this.music = next
    this.revision = (this.revision || 0) + 1
    this.markDirty()
    this.transport?.update(this.music)
    this.render()
    this.refreshAssistance()
  }

  /** Toca o documento em memória; o botão também retoma uma pausa sem reiniciar. */
  async playComposition() {
    if (!this.music || !this.transport) return
    this.activePianoRoll()?.stop()
    // Retorna da escuta isolada à mixagem completa sem rebobinar a agulha.
    this.transport.isolateTrack(null)
    if (this.playbackStatus === "playing") return
    if (this.playbackStatus === "paused") await this.transport.resume()
    else await this.transport.play(this.music)
  }

  /** Alterna o único controle principal entre tocar/retomar e parar a composição. */
  async toggleCompositionPlayback() {
    if (this.playbackStatus === "playing" || this.playbackStatus === "loading") this.stopComposition()
    else await this.playComposition()
  }

  /** Suspende a reprodução global, preservando a posição musical. */
  pauseComposition() { this.transport?.pause() }

  /** A prévia da região usa outro relógio; pausa o arranjo antes de iniciá-la. */
  previewStarted() { this.pauseComposition() }

  /** Para a reprodução global e retorna ao começo do intervalo. */
  stopComposition() { this.transport?.stop() }

  /** Ativa ou desativa o loop; durante Play a mudança vale na próxima volta. */
  toggleCompositionLoop() { this.transport?.setLoopEnabled(!this.loopEnabled) }

  /** Ouve uma faixa sem alterar solo/mute persistidos nem parar o relógio atual. */
  async playTrack(trackId) {
    if (!this.music || !this.transport) return
    this.activePianoRoll()?.stop()
    this.transport.isolateTrack(trackId)
    if (this.playbackStatus !== "playing") await this.transport.play(this.music)
  }

  /** Valida e grava os marcadores numéricos no documento musical. */
  changeLoopMarker() {
    if (!this.music) return
    try {
      const start = Number(this.loopStartTarget.value)
      const end = Number(this.loopEndTarget.value)
      this.commit(setLoopRange(this.music, start, end))
    } catch (error) {
      this.statusTarget.textContent = `Marcadores não aplicados: ${error.message}`
    }
  }

  /** Inicia arraste de um marcador mantendo a régua como origem visual. */
  startLoopMarkerDrag(event) {
    if (event.button !== 0 || !this.music) return
    event.preventDefault()
    this.markerDrag = event.currentTarget.dataset.marker
  }

  /** Move o marcador selecionado por uma batida, alternativa ao ponteiro. */
  loopMarkerKey(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !this.music) return
    event.preventDefault()
    const range = loopRange(this.music)
    const delta = (event.key === "ArrowRight" ? 1 : -1) * beatTicks(this.music)
    this.applyLoopMarker(event.currentTarget.dataset.marker, event.currentTarget.dataset.marker === "start" ? range.startTick + delta : range.endTick + delta)
    event.currentTarget.focus()
  }

  /** Mantém início menor que fim e informa erros sem perder a composição atual. */
  applyLoopMarker(marker, tick) {
    const range = loopRange(this.music)
    try {
      this.commit(setLoopRange(this.music, marker === "start" ? tick : range.startTick, marker === "end" ? tick : range.endTick))
    } catch (error) {
      this.statusTarget.textContent = `Marcadores não aplicados: ${error.message}`
    }
  }

  /** Atualiza apenas agulha e estado, sem reconstruir lanes ou editor a cada pulso. */
  onTransportState(state) {
    this.playbackStatus = state.status
    this.loopEnabled = state.loopEnabled
    if (this.music && this.hasPlayheadTarget !== false) this.playheadTarget.style.left = `${state.tick / beatTicks(this.music) * this.pixelsPerBeat}px`
    const labels = { stopped: "Parado", loading: "Carregando áudio…", playing: "Reproduzindo", paused: "Pausado", error: "Áudio indisponível" }
    if (this.hasTransportStatusTarget !== false) this.transportStatusTarget.textContent = `${labels[state.status] || state.status}${state.unavailableTrackIds?.length ? ` · ${state.unavailableTrackIds.length} faixa(s) indisponível(is)` : ""}`
    if (this.hasPlayToggleTarget) {
      const loading = state.status === "loading"
      const playing = state.status === "playing"
      this.playToggleTarget.disabled = loading
      this.playToggleTarget.setAttribute("aria-label", loading ? "Carregando áudio" : (playing ? "Parar reprodução" : "Tocar composição"))
    }
    if (this.hasPlayToggleLabelTarget) this.playToggleLabelTarget.textContent = state.status === "loading" ? "Carregando…" : (state.status === "playing" ? "Parar" : "Tocar")
    if (this.hasLoopButtonTarget) this.loopButtonTarget.setAttribute("aria-pressed", String(state.loopEnabled))
  }

  /** Localiza o controller já montado sem acoplar a timeline ao Canvas. */
  activePianoRoll() {
    if (!this.hasRegionEditorTarget) return null
    const node = this.regionEditorTarget.querySelector("[data-controller~='piano-roll']")
    return node ? this.application?.getControllerForElementAndIdentifier(node, "piano-roll") : null
  }

  /** Amplia a região ativa sem montar outro piano roll nem tocar no documento. */
  toggleRegionEditor() {
    if (this.regionEditorExpanded) this.closeRegionEditor()
    else this.openRegionEditor()
  }

  /** Isola visualmente o editor e impede foco na composição coberta pela vista maior. */
  openRegionEditor() {
    if (!this.selectedRegionId || !this.hasRegionEditorTarget || this.regionEditorTarget.hidden) return
    const host = this.regionEditorTarget
    const background = [
      ...[...document.body.children].filter((element) => element.tagName !== "MAIN"),
      ...host.closest(".compositions-editor-shell").querySelectorAll(".compositions-editor-header, .composition-timeline, .composition-assistance, .compositions-error")
    ]
    this.backgroundInert = background.map((element) => [element, element.inert])
    background.forEach((element) => { element.inert = true })
    this.previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    this.regionEditorExpanded = true
    host.classList.add("is-expanded")
    host.setAttribute("role", "dialog")
    host.setAttribute("aria-modal", "true")
    this.expandEditorButtonTarget.textContent = "Voltar à composição"
    this.expandEditorButtonTarget.setAttribute("aria-expanded", "true")
    this.expandEditorButtonTarget.focus()
  }

  /** Restaura o foco e o estado de rolagem sem interromper áudio ou notas pendentes. */
  closeRegionEditor({ restoreFocus = true } = {}) {
    if (!this.regionEditorExpanded) return
    this.regionEditorExpanded = false
    this.regionEditorTarget.classList.remove("is-expanded")
    this.regionEditorTarget.removeAttribute("role")
    this.regionEditorTarget.removeAttribute("aria-modal")
    this.backgroundInert.forEach(([element, wasInert]) => { element.inert = wasInert })
    this.backgroundInert = null
    document.body.style.overflow = this.previousBodyOverflow
    this.expandEditorButtonTarget.textContent = "Ampliar editor"
    this.expandEditorButtonTarget.setAttribute("aria-expanded", "false")
    if (restoreFocus) this.expandEditorButtonTarget.focus()
  }

  /** Captura Esc antes da grade MIDI para fechar sem limpar a seleção de notas. */
  closeExpandedOnEscape(event) {
    if (!this.regionEditorExpanded || event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    this.closeRegionEditor()
  }

  /** Seleciona uma região e inicia seu histórico com as notas locais atuais. */
  selectRegion(trackId, regionId) {
    let editorNotes
    try {
      editorNotes = toEditorNotes(regionFor(this.music, trackId, regionId))
    } catch (error) {
      this.statusTarget.textContent = `Região inválida; edição bloqueada: ${error.message}`
      return
    }
    if (this.selectedRegionId !== regionId || this.selectedTrackId !== trackId) this.activePianoRoll()?.stop()
    this.selectedTrackId = trackId
    this.selectedRegionId = regionId
    this.noteHistories ??= new Map()
    if (!this.noteHistories.has(regionId)) this.noteHistories.set(regionId, createHistory(editorNotes))
    this.render()
    this.selectedNoteIds = []
    this.refreshAssistance()
  }

  /** Atende ao pedido síncrono do editor usando IDs únicos no documento inteiro. */
  provideNoteId(event) {
    if (!this.music || !this.selectedRegionId) return
    event.detail.id = newNoteId(this.music, () => crypto.randomUUID())
  }

  /** Atualiza apenas notas da região ativa; entradas inválidas não chegam ao salvamento. */
  notesChanged(event) {
    if (!this.music || !this.selectedRegionId) return
    try {
      if (JSON.stringify(toEditorNotes(regionFor(this.music, this.selectedTrackId, this.selectedRegionId))) === JSON.stringify(event.detail.notes)) return
      this.commit(replaceRegionNotes(this.music, this.selectedTrackId, this.selectedRegionId, event.detail.notes))
    } catch (error) {
      this.statusTarget.textContent = `Notas não aplicadas: ${error.message}`
      try { this.activePianoRoll()?.replaceNotes(toEditorNotes(regionFor(this.music, this.selectedTrackId, this.selectedRegionId))) } catch { this.syncActiveEditor() }
    }
  }

  /** Registra só a operação completa, sem criar um ponto por movimento do mouse. */
  notesCommitted(event) {
    if (!this.selectedRegionId) return
    try {
      if (JSON.stringify(toEditorNotes(regionFor(this.music, this.selectedTrackId, this.selectedRegionId))) !== JSON.stringify(event.detail.notes)) return
    } catch { return }
    this.noteHistories ??= new Map()
    const history = this.noteHistories.get(this.selectedRegionId)
    if (history) this.noteHistories.set(this.selectedRegionId, record(history, event.detail.notes))
  }

  /** Restaura um passo do histórico local e marca o documento como pendente. */
  undoNotes() { this.travelNotes(undo) }

  /** Reaplica o próximo passo do histórico local após um desfazer. */
  redoNotes() { this.travelNotes(redo) }

  /** Compartilha a restauração entre desfazer/refazer sem reenviar evento do editor. */
  travelNotes(direction) {
    const history = this.noteHistories?.get(this.selectedRegionId)
    if (!history) return
    const result = direction(history)
    if (!result.changed) return
    try {
      const next = replaceRegionNotes(this.music, this.selectedTrackId, this.selectedRegionId, result.notes)
      this.noteHistories.set(this.selectedRegionId, result.history)
      this.commit(next)
      this.activePianoRoll()?.replaceNotes(result.notes)
    } catch (error) {
      this.statusTarget.textContent = `Não foi possível restaurar notas: ${error.message}`
    }
  }

  /** Atalhos pertencem à área do editor, preservando desfazer nativo em campos. */
  handleEditorKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "z") return
    if (event.target?.closest?.("input, textarea, select, [contenteditable]")) return
    event.preventDefault()
    if (event.shiftKey) this.redoNotes()
    else this.undoNotes()
  }

  /** Atualiza a orientação com dados reais da seleção, sem inferir tonalidade ou função harmônica. */
  selectionChanged(event) {
    this.selectedNoteIds = (event.detail?.notes || []).map((note) => note.id).filter(Boolean)
    this.refreshAssistance()
    if (!this.hasGuidanceTextTarget) return
    const selected = event.detail?.notes || []
    if (!selected.length) {
      this.guidanceTextTarget.textContent = "Selecione uma ou mais notas para ver sua posição MIDI, duração e intensidade."
      return
    }
    const details = selected.map((note) => `${note.name} · MIDI ${note.pitch} · início ${note.onset} ticks · duração ${note.duration} ticks · velocity ${note.velocity}`)
    const intervals = selected.length > 1 ? ` Distância entre a primeira e a última: ${Math.abs(selected.at(-1).pitch - selected[0].pitch)} semitons.` : ""
    this.guidanceTextTarget.textContent = `${details.join(" | ")}.${intervals}`
  }

  /** Consulta o domínio com o documento atual e ignora respostas de seleções antigas. */
  async refreshAssistance() {
    if (!this.music || !this.hasAssistanceUrlValue) return
    const sequence = this.assistanceSequence = (this.assistanceSequence || 0) + 1
    this.assistance = null
    if (this.hasAssistanceFieldTarget) this.assistanceFieldTarget.replaceChildren()
    if (this.hasAssistanceSuggestionsTarget) this.assistanceSuggestionsTarget.replaceChildren()
    if (this.hasAssistanceStatusTarget) this.assistanceStatusTarget.textContent = "Analisando contexto…"
    try {
      const response = await this.request(this.assistanceUrlValue, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify({ document: this.music, track_id: this.selectedTrackId,
          region_id: this.selectedRegionId, note_ids: this.selectedNoteIds || [] })
      })
      const result = await response.json()
      if (sequence !== this.assistanceSequence || this.disconnected) return
      if (!response.ok) throw new Error(result.error || "Assistência indisponível")
      this.assistance = result
      this.renderAssistance()
    } catch (error) {
      if (sequence === this.assistanceSequence && this.hasAssistanceStatusTarget) this.assistanceStatusTarget.textContent = error.message
    }
  }

  /** Apresenta o campo e as possibilidades com rótulos independentes das cores. */
  renderAssistance() {
    if (!this.hasAssistancePanelTarget || !this.assistance) return
    const { field, suggestions, out_of_context_ids: outside, status } = this.assistance
    const contextualized = status === "contextualized"
    const region = this.selectedRegionId ? regionFor(this.music, this.selectedTrackId, this.selectedRegionId) : null
    const noteState = !region ? "campo harmônico" : !region.notes.length ? "região sem notas" :
      outside.length ? `${outside.length} ${outside.length === 1 ? "nota" : "notas"} fora da escala` : "notas no contexto"
    const keyLabel = this.music.context ? `${this.music.context.tonic} ${this.music.context.mode === "major" ? "maior" : "menor natural"}` : ""
    this.assistanceStatusTarget.textContent = contextualized ? `${keyLabel} · ${noteState}` :
      status === "non_tonal_track" ? `${keyLabel} · bateria sem análise tonal` :
        "Elementos ainda não contextualizados. Escolha uma tonalidade e modo."
    this.assistanceFieldTarget.replaceChildren()
    const labels = { tonic: "Tônica", predominant: "Predominante", dominant: "Dominante" }
    for (const degree of field) {
      const card = this.element("div", `composition-assistance-degree is-${degree.function}`)
      card.setAttribute("aria-label", `${degree.degree} ${degree.symbol}, função ${labels[degree.function]}, notas ${degree.notes.join(", ")}`)
      card.append(this.element("strong", "", `${degree.degree} · ${degree.symbol}`),
        this.element("small", "", degree.notes.join(" · ")),
        this.element("span", "composition-assistance-function", labels[degree.function]))
      this.assistanceFieldTarget.append(card)
    }
    this.assistanceSuggestionsTarget.replaceChildren()
    if (suggestions.length) {
      this.assistanceSuggestionsTarget.append(this.element("h3", "", "Possibilidades para este trecho"))
      suggestions.forEach((suggestion, index) => {
        const card = this.element("div", `composition-assistance-option is-${suggestion.function}`)
        card.append(this.element("span", "", `${suggestion.degree} · ${suggestion.symbol} · ${suggestion.matching_notes} ${suggestion.matching_notes === 1 ? "nota" : "notas"} em comum`))
        const button = this.button(`Adicionar ${suggestion.symbol} à região`, (event) => this.applySuggestion(event), "composition-mini-button")
        button.dataset.index = String(index)
        card.append(button)
        this.assistanceSuggestionsTarget.append(card)
      })
    } else if (status === "non_tonal_track") {
      this.assistanceSuggestionsTarget.append(this.element("p", "", "Esta faixa de bateria não recebe sugestões tonais. O campo da composição continua disponível acima."))
    } else if (contextualized) {
      const message = this.selectedRegionId ?
        "Nenhuma tríade coincide com as notas deste trecho. Você pode continuar livremente." :
        "Selecione uma região com notas para explorar acordes possíveis."
      this.assistanceSuggestionsTarget.append(this.element("p", "", message))
    }
    this.activePianoRoll()?.setOutOfContextNotes?.(outside)
    const regionNode = this.hasTracksTarget && this.selectedRegionId ? [...this.tracksTarget.querySelectorAll(".composition-region")].find((node) => node.dataset.regionId === this.selectedRegionId) : null
    if (regionNode) {
      regionNode.classList.toggle("is-out-of-context", outside.length > 0)
      if (outside.length) regionNode.setAttribute("aria-description", `${outside.length} nota(s) fora da escala declarada`)
      else regionNode.removeAttribute("aria-description")
    }
  }

  /** Acrescenta a tríade escolhida e a registra no histórico da região ativa. */
  applySuggestion(event) {
    const suggestion = this.assistance?.suggestions?.[Number(event.currentTarget.dataset.index)]
    if (!suggestion || !this.selectedRegionId) return
    try {
      const before = toEditorNotes(regionFor(this.music, this.selectedTrackId, this.selectedRegionId))
      const next = addSuggestedChord(this.music, this.selectedTrackId, this.selectedRegionId, suggestion, () => crypto.randomUUID())
      const after = toEditorNotes(regionFor(next, this.selectedTrackId, this.selectedRegionId))
      if (after.length === before.length) return
      this.noteHistories ??= new Map()
      const history = this.noteHistories.get(this.selectedRegionId) || createHistory(before)
      this.noteHistories.set(this.selectedRegionId, record(history, after))
      this.commit(next)
      this.activePianoRoll()?.replaceNotes(after)
    } catch (error) {
      this.statusTarget.textContent = `Acorde não aplicado: ${error.message}`
    }
  }

  /** Mantém a instância fora da lane reconstruída e atualiza apenas contexto mutável. */
  syncActiveEditor() {
    if (!this.hasRegionEditorTarget) return
    const host = this.regionEditorTarget
    let region
    try {
      if (this.selectedRegionId) region = regionFor(this.music, this.selectedTrackId, this.selectedRegionId)
    } catch {
      this.noteHistories?.delete(this.selectedRegionId)
      this.selectedRegionId = null
      this.selectedTrackId = null
    }
    if (!region) {
      this.closeRegionEditor({ restoreFocus: false })
      this.activePianoRoll()?.stop()
      host.querySelector("[data-region-editor-mount]").replaceChildren()
      host.hidden = true
      this.activeEditorKey = null
      return
    }
    let editorNotes
    try {
      editorNotes = toEditorNotes(region)
    } catch (error) {
      this.closeRegionEditor({ restoreFocus: false })
      this.activePianoRoll()?.stop()
      host.querySelector("[data-region-editor-mount]").replaceChildren()
      host.hidden = true
      this.activeEditorKey = null
      this.statusTarget.textContent = `Região inválida; edição bloqueada: ${error.message}`
      return
    }
    const track = this.music.tracks.find((item) => item.id === this.selectedTrackId)
    const key = `${track.id}:${region.id}:${track.instrument_id}`
    if (this.activeEditorKey !== key) {
      this.activePianoRoll()?.stop()
      const template = host.querySelector("template")
      const node = template.content.firstElementChild.cloneNode(true)
      node.dataset.pianoRollInitialNotesValue = JSON.stringify(editorNotes)
      node.dataset.pianoRollTotalTicksValue = String(region.duration_ticks)
      node.dataset.pianoRollTimeNumeratorValue = String(this.music.time_signature.numerator)
      node.dataset.pianoRollTimeDenominatorValue = String(this.music.time_signature.denominator)
      node.dataset.pianoRollBpmValue = String(this.music.bpm)
      node.dataset.pianoRollPersistentModeValue = "true"
      node.dataset.pianoRollPartNameValue = track.name
      node.dataset.pianoRollInstrumentIdValue = track.instrument_id
      node.dataset.pianoRollLayoutValue = track.instrument_id === "drums" ? "drums" : "pitched"
      host.querySelector("[data-region-editor-mount]").replaceChildren(node)
      this.activeEditorKey = key
    } else {
      const editor = this.activePianoRoll()
      if (editor && (editor.totalTicks !== region.duration_ticks || editor.numerator() !== this.music.time_signature.numerator || editor.denominator() !== this.music.time_signature.denominator || editor.bpm() !== this.music.bpm)) {
        editor.setMusicalContext({ totalTicks: region.duration_ticks, numerator: this.music.time_signature.numerator, denominator: this.music.time_signature.denominator, bpm: this.music.bpm })
      }
    }
    host.hidden = false
    host.querySelector("[data-region-editor-title]").textContent = `Região de ${track.name}`
  }

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
    const regionIds = new Set(tracks.flatMap((track) => track.regions.map((region) => region.id)))
    for (const id of this.noteHistories?.keys() || []) {
      if (!regionIds.has(id)) this.noteHistories.delete(id)
    }
    const regions = tracks.reduce((count, track) => count + track.regions.length, 0)
    const notes = tracks.reduce((count, track) => count + track.regions.reduce((sum, region) => sum + region.notes.length, 0), 0)
    this.summaryTarget.textContent = `${tracks.length} ${tracks.length === 1 ? "faixa" : "faixas"} · ${regions} ${regions === 1 ? "região" : "regiões"} · ${notes} ${notes === 1 ? "nota" : "notas"}`
    this.emptyTarget.hidden = tracks.length > 0
    this.zoomLabelTarget.textContent = `${Math.round(this.pixelsPerBeat / 64 * 100)}%`
    const measure = measureTicks(this.music)
    const width = timelineTicks(this.music) / beatTicks(this.music) * this.pixelsPerBeat
    const playhead = this.hasPlayheadTarget ? this.playheadTarget : null
    const startHandle = this.hasLoopStartHandleTarget ? this.loopStartHandleTarget : null
    const endHandle = this.hasLoopEndHandleTarget ? this.loopEndHandleTarget : null
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
    if (playhead) marks.append(playhead)
    const range = loopRange(this.music)
    for (const [handle, tick] of [[startHandle, range.startTick], [endHandle, range.endTick]]) {
      if (!handle) continue
      handle.style.left = `${tick / beatTicks(this.music) * this.pixelsPerBeat}px`
      marks.append(handle)
    }
    this.rulerTarget.append(marks)
    if (this.hasLoopStartTarget) this.loopStartTarget.value = String(range.startTick)
    if (this.hasLoopEndTarget) this.loopEndTarget.value = String(range.endTick)
    this.tracksTarget.replaceChildren(...tracks.map((track, index) => this.trackRow(track, index, width)))
    this.syncActiveEditor()
    if (this.assistance) this.renderAssistance()
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
    const groups = new Map()
    for (const [id, definition] of Object.entries(INSTRUMENT_CATALOG)) {
      if (!groups.has(definition.category)) {
        const group = this.element("optgroup")
        group.label = definition.category
        groups.set(definition.category, group)
        instrument.append(group)
      }
      const option = this.element("option", "", definition.label)
      option.value = id
      groups.get(definition.category).append(option)
    }
    if (!INSTRUMENT_CATALOG[track.instrument_id]) {
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
      this.button("Ouvir", () => this.playTrack(track.id), "composition-mini-button"),
      this.button("+ Região", () => this.appendRegion(track), "composition-mini-button"),
      this.button("↑", () => this.commit(moveTrack(this.music, track.id, -1)), "composition-mini-button"),
      this.button("↓", () => this.commit(moveTrack(this.music, track.id, 1)), "composition-mini-button"),
      this.button("Excluir", () => { if (window.confirm(`Excluir ${track.name} e suas regiões?`)) this.commit(removeTrack(this.music, track.id)) }, "composition-mini-button composition-mini-danger")
    )
    // Rótulos completos preservam a ação ao compactar o texto visível.
    actions.children[0].setAttribute("aria-label", `Ouvir faixa ${track.name}`)
    actions.children[2].setAttribute("aria-label", `Mover faixa ${track.name} para cima`)
    actions.children[3].setAttribute("aria-label", `Mover faixa ${track.name} para baixo`)
    actions.children[4].setAttribute("aria-label", `Excluir faixa ${track.name}`)
    actions.children[2].disabled = index === 0
    actions.children[3].disabled = index === this.music.tracks.length - 1
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
    node.addEventListener("click", () => this.selectRegion(track.id, region.id))
    node.addEventListener("keydown", (event) => this.regionKey(event, track, region))
    return node
  }

  /** Guarda o ponto inicial; os listeners na janela sobrevivem ao redesenho da lane. */
  startDrag(event, track, region, mode) {
    if (event.button !== 0) return
    event.preventDefault()
    this.selectRegion(track.id, region.id)
    this.drag = { trackId: track.id, regionId: region.id, mode, x: event.clientX,
      start: region.start_tick, duration: region.duration_ticks }
    this.render()
  }

  /** Converte deslocamento em ticks com snap musical antes de alterar o documento. */
  dragMove(event) {
    if (this.markerDrag && this.music) {
      const marks = this.rulerTarget.querySelector(".composition-ruler-marks")
      const tick = Math.max(0, Math.round((event.clientX - marks.getBoundingClientRect().left) / this.pixelsPerBeat * beatTicks(this.music)))
      const current = loopRange(this.music)
      if (tick !== (this.markerDrag === "start" ? current.startTick : current.endTick)) this.applyLoopMarker(this.markerDrag, tick)
      return
    }
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
