import { Controller } from "@hotwired/stimulus"
import { appendChords, removeLastChord, moveChord, removeChord, resizeChord, roleTrack, harmonyEnd, applyRecovery } from "composition/harmony_draft"
import { editorState, applyEditorNotes } from "composition/harmony_editor"
import { newNoteId } from "composition/region_notes"
import { createHistory, record, undo, redo } from "composition/harmony_history"
import { createCompositionAudio } from "audio/composition_audio"
import { createCompositionTransport } from "audio/composition_transport"
import { INSTRUMENT_CATALOG } from "audio/phrase_instruments"
import { createHarmonyPlayback } from "audio/opendaw_harmony"

/**
 * Coordena harmonia persistida e rascunho de referência, separando escuta e aplicação.
 * O domínio fornece alturas, explicações e propostas; esta classe coordena ações e áudio.
 */
export default class extends Controller {
  static values = { document: Object, state: Object, assistUrl: String, saveUrl: String, lockVersion: Number, catalogue: Array }
  static targets = ["status", "wheel", "lane", "preview", "tonic", "mode", "instrument", "playbackMeter",
    "selection", "addButton", "removeButton", "generateButton", "continueButton", "applyPreviewButton", "playPreviewButton", "playButton", "saveButton", "saveStatus", "bpm", "slotActions", "slotLabel", "moveEarlier", "moveLater", "duration", "panel", "editorMount", "recovery", "recoveryBlocks", "recoveryNotes", "recoverySummary", "recoverySummaryText", "layer", "cursor", "ruler", "cursorText"]

  /** Inicia documento e transporte, sem criar dados de usuário no servidor. */
  connect() {
    this.connectionRevision = (this.connectionRevision || 0) + 1
    const reconnecting = Boolean(this.music)
    this.saving = false
    if (!reconnecting) {
      this.dirty = false
      this.editRevision = 0
      this.music = structuredClone(this.documentValue)
      if (this.hasSaveUrlValue && !this.music.harmony && roleTrack(this.music).regions[0].notes.length === 0) this.music.harmony = { blocks: [] }
      this.history = createHistory(this.music)
      this.activeRole = "realization"
      this.positionTick = 0
      this.state = structuredClone(this.stateValue)
      this.preview = null
      this.selectedIndex = null
      this.selectedSlot = null
      this.revision = 0
      this.auditionRevision = 0
    }
    const playback = this.createPlayback()
    this.audio = playback.audio
    this.transport = playback.transport
    this.transport.setLoopEnabled(false)
    this.transport.update(this.music)
    this.onBeforeUnload = (event) => this.warnBeforeUnload(event)
    window.addEventListener("beforeunload", this.onBeforeUnload)
    this.onKeyTransport = (event) => this.transportKey(event)
    this.onBeforeCache = () => this.disconnect()
    window.addEventListener("keydown", this.onKeyTransport)
    window.addEventListener("turbo:before-cache", this.onBeforeCache)
    this.populateInstruments()
    this.render?.()
    if (this.hasPanelTarget && this.panelTarget.dataset.panel === "editor") this.panelLoaded()
  }

  /** Encerra fonte e relógio compartilhados ao sair da página. */
  disconnect() {
    window.removeEventListener("beforeunload", this.onBeforeUnload)
    window.removeEventListener("keydown", this.onKeyTransport)
    window.removeEventListener("turbo:before-cache", this.onBeforeCache)
    this.revision += 1
    this.auditionRevision += 1
    this.connectionRevision += 1
    this.transport?.dispose()
  }

  /** Permite que a harmonia persistida use outro motor sem duplicar edição e análise. */
  createPlayback() {
    if (this.hasSaveUrlValue) return { audio: null, transport: createHarmonyPlayback({ onState: (state) => this.transportState(state) }) }
    const audio = createCompositionAudio()
    return { audio, transport: createCompositionTransport({ audio, onState: (state) => this.transportState(state) }) }
  }

  /** Mostra a opção selecionada e a toca, sem acrescentar notas à faixa. */
  async selectChord(event) {
    const index = Number(event.currentTarget.dataset.index)
    const option = this.state?.options?.[index]
    if (!option) return
    const audition = ++this.auditionRevision
    this.selectedIndex = index
    this.render?.()
    try {
      if (this.hasSaveUrlValue) {
        await this.transport.audition(this.music, option.pitches)
        return
      }
      this.transport.stop()
      const track = this.music.tracks[0]
      await this.audio.loadTrack(track)
      if (audition !== this.auditionRevision) return
      await this.audio.start()
      if (audition !== this.auditionRevision) return
      const duration = 60 / this.music.bpm
      // A pré-escuta usa o relógio imediato do instrumento, não a posição do transporte.
      for (const pitch of option.pitches) this.audio.trigger(track.id, pitch, duration, undefined, 90)
      this.statusTarget.textContent = `${option.symbol} no ${this.instrumentLabel()}. Use Adicionar para colocá-lo na faixa.`
    } catch (error) {
      if (audition === this.auditionRevision) this.statusTarget.textContent = `Áudio indisponível: ${error.message}. O acorde continua selecionado.`
    }
  }

  /** Converte somente o acorde escolhido em três eventos no próximo tempo livre. */
  async applySelected() {
    const option = this.state?.options?.[this.selectedIndex]
    if (!option || !this.state?.can_append) return
    try {
      this.commit(appendChords(this.music, [{ ...option, onset_tick: this.state.next_onset_tick }], () => crypto.randomUUID()))
      await this.requestState("analyze")
    } catch (error) {
      this.statusTarget.textContent = `Acorde não aplicado: ${error.message}`
    }
  }

  /** Reclassifica notas existentes ao trocar a tonalidade declarada. */
  async changeContext() {
    this.commit({ ...this.music, context: { tonic: this.tonicTarget.value, mode: this.modeTarget.value } })
    this.selectedIndex = null
    await this.requestState("analyze")
  }

  /** Mantém o timbre entre camadas e atualiza a análise pendente sem alterar notas MIDI. */
  async changeInstrument() {
    const instrument = this.instrumentTarget.value
    if (!instrument || instrument === "drums") return
    if (this.hasSaveUrlValue && !this.catalogueValue.some(item => item.id === instrument)) return
    this.music = structuredClone(this.music)
    for (const role of ["realization", "additional"]) { const track = roleTrack(this.music, role); if (track) track.instrument_id = instrument }
    this.commit(this.music)
    this.statusTarget.textContent = `Instrumento: ${this.instrumentLabel()}.`
    this.render?.()
    // O gesto de escolha permite preparar o timbre antes da próxima escuta.
    // Sem notas, o motor ainda não dispõe de uma região executável.
    if (this.hasSaveUrlValue && harmonyEnd(this.music) && this.transport.warm) {
      const chosenMusic = this.music
      void this.transport.warm(this.music).catch(error => {
        if (chosenMusic === this.music) this.statusTarget.textContent = `Não foi possível preparar o instrumento: ${error.message}`
      })
    }
    await this.requestState("analyze")
  }

  /** Solicita quatro opções para iniciar a faixa sem aplicá-las. */
  async generate() { await this.requestState("generate") }

  /** Solicita quatro opções baseadas no último acorde MIDI reconhecido. */
  async continue() { await this.requestState("continue") }

  /** Acrescenta a prévia ao MIDI só após confirmação explícita. */
  async applyPreview() {
    if (!this.preview?.length) return
    try {
      this.commit(appendChords(this.music, this.preview, () => crypto.randomUUID()))
      await this.requestState("analyze")
    } catch (error) {
      this.statusTarget.textContent = `Prévia não aplicada: ${error.message}`
    }
  }

  /** Escuta composição e quatro acordes propostos sem gravar a prévia. */
  async playPreview() {
    if (!this.preview?.length) return
    try {
      const temporary = appendChords(this.music, this.preview, () => crypto.randomUUID())
      if (this.transport.preview) await this.transport.preview(temporary)
      else await this.transport.play(temporary)
    } catch (error) {
      this.statusTarget.textContent = `Prévia não pôde ser tocada: ${error.message}`
    }
  }

  /** Reproduz só o documento já aplicado, uma vez, usando o transporte existente. */
  async play() {
    if (!harmonyEnd(this.music)) {
      this.statusTarget.textContent = "Adicione um acorde antes de tocar a progressão."
      return
    }
    if (["playing", "loading"].includes(this.playbackStatus) && this.transport.pause) { this.transport.pause(); return }
    try { await this.transport.play(this.music) }
    catch (error) { this.statusTarget.textContent = `Áudio indisponível: ${error.message}` }
  }

  /** Interrompe a reprodução sem alterar a progressão. */
  stop() { this.auditionRevision += 1; this.transport.stop() }

  /** Retira só o tempo final; a seleção e as demais notas permanecem. */
  async removeLast() {
    if (!this.music.tracks[0].regions[0].notes.length) return
    try {
      this.commit(removeLastChord(this.music))
      await this.requestState("analyze")
    } catch (error) {
      this.statusTarget.textContent = `Não foi possível remover: ${error.message}`
    }
  }

  /** Seleciona um acorde já aplicado para organizar a timeline, sem inserir notas. */
  selectSlot(event) {
    if (this.suppressSlotClick) { this.suppressSlotClick = false; return }
    if (!this.state) return
    this.selectedSlot = Number(event.currentTarget.dataset.index)
    this.render()
  }

  /** Captura arrasto do mouse; toque continua reservado à rolagem e aos botões. */
  beginSlotPointer(event) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !this.state) return
    this.slotPointer = { from: Number(event.currentTarget.dataset.index), x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /** Resolve o destino pela posição de soltura, sem alterar a ordem durante o gesto. */
  async finishSlotPointer(event) {
    const gesture = this.slotPointer
    this.slotPointer = null
    if (!gesture || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 8) return
    this.suppressSlotClick = true
    const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest(".harmony-beat[data-index]")
    if (destination && this.laneTarget.contains(destination)) await this.reorder(gesture.from, Number(destination.dataset.index))
  }

  /** Cancela o gesto quando o navegador assume o ponteiro ou a janela perde a interação. */
  cancelSlotPointer() { this.slotPointer = null }

  /** Alternativa ao arrasto para toque e teclado: botões Antes/Depois. */
  async moveSelected(event) {
    if (this.selectedSlot === null) return
    await this.reorder(this.selectedSlot, this.selectedSlot + Number(event.currentTarget.dataset.offset))
  }

  /** Alt+setas reorganiza sem depender de mouse; setas normais rolam a timeline. */
  async slotKeydown(event) {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return
    event.preventDefault()
    const from = Number(event.currentTarget.dataset.index)
    await this.reorder(from, from + (event.key === "ArrowLeft" ? -1 : 1))
  }

  /** Atualiza documento, análise e foco; inválidos ou pedidos durante análise são ignorados. */
  async reorder(from, to) {
    const count = this.state?.slots?.length || 0
    if (!this.state || from === to || to < 0 || to >= count) return
    try {
      this.commit(moveChord(this.music, this.music.harmony ? this.state.slots[from].id : from, to))
      this.selectedSlot = to
      await this.requestState("analyze")
      this.laneTarget.querySelector(`[data-index="${to}"]`)?.focus()
      this.statusTarget.textContent = `Acorde movido para o tempo ${to + 1}.`
    } catch (error) { this.statusTarget.textContent = `Não foi possível mover: ${error.message}` }
  }

  /** Remove somente o acorde selecionado, conservando as notas dos demais. */
  async removeSelected() {
    if (this.selectedSlot === null || !this.state) return
    try {
      this.commit(removeChord(this.music, this.music.harmony ? this.state.slots[this.selectedSlot].id : this.selectedSlot))
      this.selectedSlot = null
      await this.requestState("analyze")
    } catch (error) { this.statusTarget.textContent = `Não foi possível remover: ${error.message}` }
  }

  /** Busca leitura ou prévia e ignora respostas que chegaram após outra ação. */
  async requestState(operation) {
    const revision = ++this.revision
    this.preview = null
    this.state = null
    this.render?.()
    try {
      const response = await this.request(this.assistUrlValue, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify({ document: this.music, operation })
      })
      const result = await response.json()
      if (revision !== this.revision) return
      if (!response.ok) throw new Error(result.error || "Assistência indisponível")
      this.state = result.state
      this.preview = operation === "analyze" ? null : result.preview
      this.render?.()
    } catch (error) {
      if (revision === this.revision) this.statusTarget.textContent = `Assistência indisponível: ${error.message}`
    }
  }

  /** Usa fetch como borda substituível por testes sem duplicar o protocolo. */
  request(url, options) { return fetch(url, options) }

  /** Preenche timbres conhecidos pelo áudio; bateria não é tonal nesta experiência. */
  populateInstruments() {
    if (this.hasInstrumentTarget === false || !this.instrumentTarget) return
    const selected = roleTrack(this.music).instrument_id
    this.instrumentTarget.replaceChildren()
    if (new Set(this.music.tracks.map(track => track.instrument_id)).size > 1) {
      const mixed = document.createElement("option"); mixed.value = ""; mixed.textContent = "Timbres diferentes"; mixed.selected = true
      this.instrumentTarget.append(mixed)
    }
    const entries = this.hasSaveUrlValue
      ? this.catalogueValue.map(item => [item.id, item])
      : Object.entries(INSTRUMENT_CATALOG)
    for (const [id, definition] of entries) {
      if (id === "drums") continue
      const option = document.createElement("option")
      option.value = id
      option.textContent = definition.label
      option.selected = this.music.tracks.every(track => track.instrument_id === selected) && id === selected
      this.instrumentTarget.append(option)
    }
  }

  /** Restaura os controles visíveis para os valores do documento após desfazer/refazer. */
  syncMusicalControls() {
    if (this.hasBpmTarget) this.bpmTarget.value = this.music.bpm
    if (this.hasTonicTarget) this.tonicTarget.value = this.music.context?.tonic || ""
    if (this.hasModeTarget) this.modeTarget.value = this.music.context?.mode || "major"
    this.populateInstruments()
  }

  /** Atualiza apresentação e disponibilidade de ações a partir do MIDI analisado. */
  render() {
    if (this.hasWheelTarget !== false && this.wheelTarget) this.renderWheel()
    if (this.hasLaneTarget !== false && this.laneTarget) this.renderLane()
    if (this.hasPreviewTarget !== false && this.previewTarget) this.renderPreview()
    this.renderSlotActions()
    this.renderRecovery()
    this.renderCursor()
    const selected = this.state?.options?.[this.selectedIndex]
    if (this.hasSelectionTarget !== false && this.selectionTarget) this.selectionTarget.textContent = selected
        ? `${selected.symbol} · Notas: ${selected.notes.join(", ")}. ${selected.explanation || "Este acorde faz parte do tom escolhido."}`
        : "Escolha um acorde para ouvir e ver o que ele pode trazer à música."
    const disabled = { addButton: !selected || !this.state?.can_append,
      removeButton: !this.state || this.state.guided === false,
      playButton: !harmonyEnd(this.music),
      generateButton: !this.state?.can_generate, continueButton: !this.state?.can_continue,
      applyPreviewButton: !this.preview?.length, playPreviewButton: !this.preview?.length }
    for (const [name, value] of Object.entries(disabled)) {
      const flag = `has${name[0].toUpperCase()}${name.slice(1)}Target`
      if (this[flag] !== false && this[`${name}Target`]) this[`${name}Target`].disabled = value
    }
  }

  /** Reconstrói as opções ao mudar o contexto, sem calcular acordes na interface. */
  renderWheel() {
    // A ativação por teclado substitui o botão; devolvemos o foco à mesma cifra.
    const focused = document.activeElement
    const restoreFocus = this.wheelTarget.contains(focused) &&
      focused?.dataset?.index !== undefined && Number(focused.dataset.index) === this.selectedIndex
    this.wheelTarget.replaceChildren()
    if (!this.state) {
      this.wheelTarget.textContent = "Atualizando campo harmônico…"
      return
    }
    for (const option of this.state.options) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = `harmony-chord is-${option.function}`
      const recommended = this.state.recommended_indices?.includes(option.index)
      if (recommended) button.className += " is-recommended"
      button.dataset.index = option.index
      button.setAttribute("data-action", "click->harmony#selectChord")
      button.setAttribute("aria-label", `Ouvir ${option.symbol}. ${option.explanation}${recommended ? " Recomendado." : ""}`)
      button.setAttribute("aria-pressed", option.index === this.selectedIndex ? "true" : "false")
      const degree = document.createElement("small")
      degree.textContent = option.degree
      const symbol = document.createElement("strong")
      symbol.textContent = option.symbol
      button.append(degree, symbol)
      if (recommended) {
        const hint = document.createElement("span")
        hint.className = "harmony-recommendation"
        hint.textContent = "Sugerido"
        button.append(hint)
      }
      this.wheelTarget.append(button)
    }
    if (restoreFocus) this.wheelTarget.children[this.selectedIndex]?.focus()
  }

  /** Agrupa quatro tempos por compasso conforme as posições recebidas do domínio. */
  renderLane() {
    if (!this.state) return
    const scrollLeft = this.laneTarget.scrollLeft
    const active = document.activeElement
    const focusedIndex = this.laneTarget.contains(active) ? active?.dataset?.index : undefined
    this.laneTarget.replaceChildren()
    const slots = this.state?.slots || []
    if (this.state.guided === false) {
      const region = this.music?.tracks?.[0]?.regions?.[0]
      const notes = region?.notes || []
      const summary = document.createElement("div")
      summary.className = "harmony-lane-free"
      const title = document.createElement("strong")
      title.textContent = "Sequência editada"
      const details = document.createElement("span")
      const beats = Math.max(1, (region?.duration_ticks || 0) / 480)
      details.textContent = `${notes.length} ${notes.length === 1 ? "nota" : "notas"} · ${beats} ${beats === 1 ? "tempo" : "tempos"}`
      const reason = document.createElement("p")
      reason.textContent = this.state.editing_reason || "Use Editar composição para modificar as notas."
      summary.append(title, details, reason)
      this.laneTarget.append(summary)
      return
    }
    const count = Math.max(1, slots.length + (this.state.can_append ? 1 : 0))
    for (let start = 0; start < count; start += 1) {
      const measure = document.createElement("div")
      measure.className = "harmony-measure"
      const heading = document.createElement("h3")
      const onset = slots[start]?.onset_tick ?? this.state.next_onset_tick
      heading.textContent = `Compasso ${Math.floor(onset / 1920) + 1} · ${onset % 1920 / 480 + 1}`
      const beats = document.createElement("div")
      beats.className = "harmony-beats"
      for (let offset = 0; offset < 1; offset += 1) {
        const index = start + offset
        const slot = slots[index]
        const beat = document.createElement(slot ? "button" : "div")
        beat.className = `harmony-beat ${slot ? this.tensionClass(slot.tension) : "is-empty"}`
        beat.dataset.beat = index + 1
        beat.style.width = `${(slot ? (slot.duration_ticks || 480) / 480 : 1) * this.beatPixels()}px`
        if (slot) {
          beat.type = "button"
          beat.dataset.index = index
          beat.setAttribute("aria-pressed", this.selectedSlot === index ? "true" : "false")
          beat.setAttribute("aria-label", `${slot.symbol || "Acorde"}, bloco ${index + 1}, ${(slot.duration_ticks || 480) / 480} tempos. Alt e setas para mover.`)
          beat.setAttribute("data-action", "click->harmony#selectSlot keydown->harmony#slotKeydown pointerdown->harmony#beginSlotPointer pointerup->harmony#finishSlotPointer pointercancel->harmony#cancelSlotPointer")
        }
        const label = document.createElement("small")
        label.textContent = slot ? `${(slot.duration_ticks || 480) / 480} tempos` : "Adicionar"
        const symbol = document.createElement("strong")
        symbol.textContent = slot ? (slot.symbol ? `${slot.degree ? slot.degree + " · " : ""}${slot.symbol}` : "Fora do campo") : (index === slots.length ? "Próximo acorde" : "—")
        beat.append(label, symbol)
        if (slot) {
          const detail = document.createElement("span")
          detail.textContent = slot.id ? `Acorde declarado · ${slot.empty ? "Sem notas na realização" : slot.notes_edited ? "Notas editadas" : slot.tension}${slot.crossing ? " · Nota atravessa o próximo bloco" : ""}` : slot.tension
          beat.title = slot.explanation
          beat.append(detail)
        }
        beats.append(beat)
      }
      measure.append(heading, beats)
      this.laneTarget.append(measure)
    }
    this.laneTarget.scrollLeft = scrollLeft
    if (focusedIndex !== undefined) this.laneTarget.querySelector?.(`[data-index="${focusedIndex}"]`)?.focus()
  }

  /** Exibe ações somente quando há um acorde selecionado e respeita os limites da faixa. */
  renderSlotActions() {
    if (!this.hasSlotActionsTarget) return
    const count = this.state?.slots?.length || 0
    const selected = this.state?.guided !== false && Number.isInteger(this.selectedSlot) && this.selectedSlot < count
    this.slotActionsTarget.hidden = !selected
    if (!selected) return
    this.slotLabelTarget.textContent = `Acorde ${this.selectedSlot + 1}`
    if (this.hasDurationTarget) this.durationTarget.value = this.state.slots[this.selectedSlot].duration_ticks || 480
    this.moveEarlierTarget.disabled = !this.state || this.selectedSlot === 0
    this.moveLaterTarget.disabled = !this.state || this.selectedSlot === count - 1
  }

  /** Exibe prévias sem modificar o documento MIDI até a confirmação. */
  renderPreview() {
    this.previewTarget.replaceChildren()
    if (!this.preview?.length) {
      const message = document.createElement("p")
      message.textContent = this.state?.continue_reason || "Gere uma sugestão para experimentar."
      this.previewTarget.append(message)
      return
    }
    for (const option of this.preview) {
      const card = document.createElement("div")
      card.className = `harmony-preview-card is-${option.function}`
      const beat = document.createElement("small")
      beat.textContent = `Compasso ${Math.floor(option.onset_tick / 1920) + 1} · tempo ${Math.floor(option.onset_tick / 480) % 4 + 1}`
      const symbol = document.createElement("strong")
      symbol.textContent = `${option.degree} · ${option.symbol}`
      const detail = document.createElement("span")
      detail.textContent = this.functionLabel(option.function)
      card.append(beat, symbol, detail)
      this.previewTarget.append(card)
    }
  }

  /** Rótulos verbais acompanham as cores para leitura acessível. */
  functionLabel(value) {
    return { tonic: "repouso (tônica)", predominant: "preparação (predominante)", dominant: "tensão (dominante)" }[value] || "fora do campo"
  }

  /** Restringe classes CSS ao vocabulário didático conhecido. */
  tensionClass(value) {
    return { repouso: "is-tonic", resolução: "is-tonic", preparação: "is-predominant", tensão: "is-dominant" }[value] || "is-outside"
  }

  /** Invalida a prévia e cessa reprodução após uma edição local. */
  invalidate() {
    this.dirty = true
    this.editRevision += 1
    if (this.hasSaveUrlValue) {
      this.saveStatusTarget.textContent = "Alterações não salvas"
      this.saveButtonTarget.disabled = this.saving
    }
    this.revision += 1
    this.auditionRevision += 1
    this.preview = null
    this.transport.update(this.music)
    this.render?.()
  }

  /** Troca o documento inteiro somente depois de uma ação aplicada. */
  commit(next) {
    this.music = next
    this.history = record(this.history, this.music)
    this.invalidate()
    this.syncEditor()
  }

  /** Usa o próprio seletor visível no texto de confirmação da escuta. */
  instrumentLabel() {
    if (this.hasSaveUrlValue) return this.catalogueValue?.find(item => item.id === this.music.tracks[0].instrument_id)?.label || "sintetizador"
    return this.instrumentTarget?.selectedOptions?.[0]?.textContent || this.music.tracks[0].instrument_id
  }

  /** Expõe falhas do transporte sem modificar o estado musical. */
  transportState(state) {
    this.playbackStatus = state.status
    // O SVG indica reprodução, não amplitude medida; CSS mantém os demais estados imóveis.
    if (this.hasPlaybackMeterTarget) this.playbackMeterTarget.dataset.state = state.status
    if (Number.isFinite(state.positionTick)) this.positionTick = state.positionTick
    this.renderCursor()
    if (this.hasPlayButtonTarget) this.playButtonTarget.textContent = ["playing", "loading"].includes(state.status) ? "Pausar" : "Ouvir harmonia"
    if (this.hasSaveUrlValue) {
      const loadingText = Number.isFinite(state.progress)
        ? `Carregando instrumentos… ${Math.round(Math.max(0, Math.min(1, state.progress)) * 100)}%`
        : "Preparando os instrumentos…"
      this.statusTarget.textContent = { loading: loadingText, playing: "Tocando", paused: "Pausado", stopped: "", error: "Não foi possível iniciar o som. Tente novamente." }[state.status] || ""
      return
    }
    if (state.status === "error") this.statusTarget.textContent = "Áudio indisponível. Sua progressão continua nesta página."
  }

  /** Alerta o navegador apenas quando a sessão possui conteúdo não salvo. */
  warnBeforeUnload(event) {
    if (this.hasSaveUrlValue && !this.dirty) return
    if (this.hasSaveUrlValue && this.dirty) { event.preventDefault(); event.returnValue = ""; return }
    if (!this.music?.tracks?.[0]?.regions?.[0]?.notes?.length) return
    event.preventDefault()
    event.returnValue = ""
  }

  /** Altera o andamento em BPM, preserva os ticks e renova a análise em andamento. */
  async changeBpm() {
    const bpm = Number(this.bpmTarget.value)
    if (!Number.isInteger(bpm) || bpm < 30 || bpm > 240) {
      this.bpmTarget.value = this.music.bpm
      this.statusTarget.textContent = "Escolha um andamento entre 30 e 240."
      return
    }
    this.commit({ ...this.music, bpm })
    await this.requestState("analyze")
  }

  /** Redimensiona somente o bloco selecionado; o helper desloca os sucessores. */
  async changeDuration() {
    if (this.selectedSlot === null || !this.state || this.state.guided === false) return
    try {
      this.commit(resizeChord(this.music, this.music.harmony ? this.state.slots[this.selectedSlot].id : this.selectedSlot, Number(this.durationTarget.value)))
      await this.requestState("analyze")
    } catch (error) { this.statusTarget.textContent = error.message }
  }

  /** Guarda a intenção mais recente; o frame não se torna proprietário do documento. */
  selectPanel(event) {
    this.captureRecoveryForm()
    this.expectedPanel = event.currentTarget.dataset.panel
    this.editor = null
    this.panelTarget?.scrollIntoView?.({ block: "start", behavior: "smooth" })
  }

  /** Guarda escolhas manuais antes que o Turbo Frame remova o formulário auxiliar. */
  captureRecoveryForm() {
    if (!this.hasRecoveryTarget || this.recoveryTarget.hidden) return
    this.readRecoveryBlocks()
    this.recoveryAssignments = Object.fromEntries(Array.from(this.recoveryNotesTarget.querySelectorAll("select")).map((select) => [select.dataset.noteId, select.value]))
  }

  /** Recusa resposta de painel obsoleta antes de substituir a área visível. */
  beforePanelRender(event) {
    const incoming = event.detail.newFrame.dataset.panel
    if (this.expectedPanel && incoming !== this.expectedPanel) event.preventDefault()
  }

  /** Hidrata o HTML de apresentação com o rascunho atual, nunca com notas do GET. */
  panelLoaded() {
    this.editor = null
    this.render()
    const loadedPanel = this.expectedPanel || this.panelTarget?.dataset?.panel
    if (loadedPanel && this.hasPanelTarget && this.panelTarget?.dataset) this.panelTarget.dataset.panel = loadedPanel
    this.element?.querySelectorAll?.(".harmony-panel-nav [data-panel]").forEach((link) => {
      // A classe visual e o estado acessível devem apontar para o mesmo painel.
      const current = Boolean(loadedPanel && link.dataset.panel === loadedPanel)
      link.classList.toggle("is-current", current)
      if (current) link.setAttribute("aria-current", "page")
      else link.removeAttribute("aria-current")
    })
    this.syncMusicalControls()
    if (this.hasLayerTarget) this.layerTarget.value = this.activeRole
    if (!this.hasEditorMountTarget) { this.revealLoadedPanel(); return }
    const template = this.editorMountTarget.querySelector("template")
    if (!template) return
    const fragment = template.content.cloneNode(true)
    const root = fragment.querySelector('[data-controller="piano-roll"]')
    const state = editorState(this.music, this.activeRole)
    const values = { "initial-notes": JSON.stringify(state.notes), "total-ticks": state.totalTicks,
      "time-numerator": state.numerator, "time-denominator": state.denominator,
      bpm: state.bpm, "persistent-mode": true, "audio-enabled": false }
    for (const [key, value] of Object.entries(values)) root.setAttribute(`data-piano-roll-${key}-value`, value)
    this.editorMountTarget.append(fragment)
    template.remove()
    this.revealLoadedPanel()
  }

  /** Alinha o conteúdo recém-carregado para que o usuário veja o destino da navegação. */
  revealLoadedPanel() {
    if (!this.expectedPanel) return
    if (this.expectedPanel === "guided") {
      if (this.hasWheelTarget) this.wheelTarget.scrollIntoView?.({ block: "start", behavior: "smooth" })
      return
    }
    const heading = this.hasPanelTarget ? this.panelTarget.querySelector("h2") : null
    heading?.scrollIntoView?.({ block: "start", behavior: "smooth" })
  }

  /** Recebe a instância já conectada e entrega foco sem reconstruir a música. */
  editorReady(event) {
    this.editor = this.application.getControllerForElementAndIdentifier(event.target, "piano-roll")
    this.renderCursor()
    event.target.querySelector('[data-piano-roll-target="roll"]')?.focus()
  }

  /** Fornece identidade global ao editor antes de criar uma nota. */
  provideNoteId(event) { event.detail.id = newNoteId(this.music, () => crypto.randomUUID()) }

  /** Mantém cada gesto no documento em memória; não grava no servidor nem quantiza. */
  notesChanged(event) {
    if (event.target && this.editor && event.target !== this.editor.element) return
    try {
      this.music = applyEditorNotes(this.music, event.detail.notes, this.activeRole)
      this.state = null
      this.invalidate()
    } catch (error) {
      this.statusTarget.textContent = error.message
      this.editor?.replaceNotes(editorState(this.music, this.activeRole).notes)
    }
  }

  /** Registra um ponto por gesto finalizado e solicita análise não destrutiva. */
  async notesCommitted(event) {
    if (JSON.stringify(editorState(this.music, this.activeRole).notes) !== JSON.stringify(event.detail.notes)) return
    this.history = record(this.history, this.music)
    await this.requestState("analyze")
  }

  /** Restaura notas e reanalisa sem inserir novo ponto no histórico. */
  async restoreHistory(result) {
    if (!result.changed) return
    this.history = result.history
    this.music = result.document
    this.syncMusicalControls()
    this.syncEditor()
    this.invalidate()
    await this.requestState("analyze")
  }

  /** Desfaz o último gesto confirmado da região atual. */
  async undoNotes() { await this.restoreHistory(undo(this.history)) }

  /** Refaz um gesto desfeito sem alterar sua identidade musical. */
  async redoNotes() { await this.restoreHistory(redo(this.history)) }

  /** Mantém o rascunho disponível quando o servidor não consegue carregar um painel. */
  panelFailed(event) {
    event.preventDefault()
    this.statusTarget.textContent = "Não foi possível abrir o painel. Suas alterações continuam aqui; tente novamente."
  }

  /** Hidrata a camada escolhida sem trocar o documento ou apagar seu histórico. */
  changeLayer(event) {
    this.activeRole = event.target.value
    this.syncEditor()
  }

  /** Atualiza limites e notas sem publicar edição; cursor é aplicado depois da montagem. */
  syncEditor() {
    if (!this.editor) return
    const state = editorState(this.music, this.activeRole)
    this.editor.replaceNotes([])
    this.editor.setMusicalContext(state)
    this.editor.replaceNotes(state.notes)
    this.renderCursor()
  }

  /** Desenha proposta ou formulário manual uma vez por revisão de recuperação. */
  renderRecovery() {
    const recovery = this.state?.recovery
    const needed = !this.music.harmony && recovery && !["empty", "not_needed"].includes(recovery.status)
    if (this.hasRecoverySummaryTarget) {
      this.recoverySummaryTarget.hidden = !needed
      if (needed && this.hasRecoverySummaryTextTarget) {
        const count = recovery.blocks?.length || 0
        this.recoverySummaryTextTarget.textContent = `${count} ${count === 1 ? "acorde aguarda" : "acordes aguardam"} revisão antes de liberar a sequência guiada.`
      }
    }
    if (!this.hasRecoveryTarget) return
    this.recoveryTarget.hidden = !needed
    if (!needed) return
    const source = JSON.stringify(recovery)
    if (this.recoverySource !== source || !this.manualBlocks) {
      this.recoverySource = source
      this.manualBlocks = structuredClone(recovery.blocks || [])
      this.recoveryAssignments = structuredClone(recovery.assignments || {})
    }
    this.renderRecoveryBlocks()
    this.recoveryNotesTarget.replaceChildren()
    for (const note of roleTrack(this.music).regions[0].notes) {
      const label = document.createElement("label"), select = document.createElement("select")
      label.textContent = `MIDI ${note.pitch} · início ${note.onset_tick} · duração ${note.duration_ticks} `
      select.dataset.noteId = note.id
      for (const [value, text] of [["realization", "Acordes"], ["additional", "Notas adicionais"]]) {
        const option = document.createElement("option"); option.value = value; option.textContent = text
        option.selected = (this.recoveryAssignments[note.id] || "additional") === value; select.append(option)
      }
      label.append(select); this.recoveryNotesTarget.append(label)
    }
  }

  /** Acrescenta linha de declaração manual; nenhuma nota é alterada até confirmar. */
  addRecoveryBlock() {
    if (this.manualBlocks.length >= 32) return
    this.readRecoveryBlocks()
    this.manualBlocks.push({ id: crypto.randomUUID(), onset_tick: 0, duration_ticks: 480, chord: { root: "C", quality: "major" } })
    this.renderRecoveryBlocks()
  }

  /** Remove somente a última linha da proposta, sem afetar a composição. */
  removeRecoveryBlock() { this.readRecoveryBlocks(); this.manualBlocks.pop(); this.renderRecoveryBlocks() }

  /** Constrói controles rotulados sem inserir texto do documento como HTML. */
  renderRecoveryBlocks() {
    this.recoveryBlocksTarget.replaceChildren()
    this.manualBlocks.forEach((block, index) => {
      const row = document.createElement("div"); row.className = "harmony-recovery-row"
      const rootLabel = document.createElement("label"), root = document.createElement("input")
      rootLabel.textContent = `Acorde ${index + 1} · fundamental `; root.value = block.chord.root; root.dataset.field = "root"; root.size = 3; rootLabel.append(root); row.append(rootLabel)
      for (const [field, values] of [["quality", [["major", "Maior"], ["minor", "Menor"], ["diminished", "Diminuto"]]], ["duration", [[240, "½ tempo"], [480, "1 tempo"], [960, "2 tempos"], [1920, "4 tempos"]]]]) {
        const label = document.createElement("label"), select = document.createElement("select")
        label.textContent = field === "quality" ? "Qualidade " : "Duração "; select.dataset.field = field
        for (const [value, text] of values) { const option = document.createElement("option"); option.value = value; option.textContent = text; option.selected = String(value) === String(field === "quality" ? block.chord.quality : block.duration_ticks); select.append(option) }
        label.append(select); row.append(label)
      }
      this.recoveryBlocksTarget.append(row)
    })
  }

  /** Lê o formulário completo e calcula inícios contíguos, sem inferência de notas. */
  readRecoveryBlocks() {
    let onset = 0
    Array.from(this.recoveryBlocksTarget.children).forEach((row, index) => {
      const block = this.manualBlocks[index]
      block.chord = { root: row.querySelector('[data-field="root"]').value, quality: row.querySelector('[data-field="quality"]').value }
      block.duration_ticks = Number(row.querySelector('[data-field="duration"]').value)
      block.onset_tick = onset; onset += block.duration_ticks
    })
  }

  /** Aplica partição explícita como uma operação desfeita integralmente pelo histórico. */
  async confirmRecovery() {
    try {
      this.readRecoveryBlocks()
      this.recoveryAssignments = Object.fromEntries(Array.from(this.recoveryNotesTarget.querySelectorAll("select")).map(select => [select.dataset.noteId, select.value]))
      this.commit(applyRecovery(this.music, this.manualBlocks, this.recoveryAssignments, () => crypto.randomUUID()))
      await this.requestState("analyze")
    } catch (error) { this.statusTarget.textContent = error.message }
  }

  /** Descarta apenas mudanças do formulário; o rascunho permanece exatamente igual. */
  /**
   * Descarta os ajustes manuais da recuperação e volta a derivar o formulário
   * da proposta original, sem aplicar alterações à composição.
   */
  cancelRecovery() {
    this.recoverySource = null
    this.manualBlocks = undefined
    this.recoveryAssignments = undefined
    this.recoveryRendered = null
    this.renderRecovery()
  }

  /** Ignora atalhos pertencentes a controles ou a outro editor. */
  transportKey(event) {
    if (event.code !== "Space" || event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target?.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable]:not([contenteditable="false"])')) return
    event.preventDefault(); void this.play()
  }

  /** Mede cada semínima da timeline em pixels sem alterar os ticks do documento. */
  beatPixels() { return this.hasSaveUrlValue ? 108 : 136 }

  /** Publica posição observada nos dois painéis sem transformá-la em edição musical. */
  renderCursor() {
    const tick = this.positionTick || 0
    if (this.hasCursorTarget) this.cursorTarget.style.left = `${tick / 480 * this.beatPixels()}px`
    if (this.hasRulerTarget) {
      this.rulerTarget.style.width = `${Math.max(480, harmonyEnd(this.music)) / 480 * this.beatPixels()}px`
      this.rulerTarget.setAttribute("aria-valuemax", String(harmonyEnd(this.music)))
      this.rulerTarget.setAttribute("aria-valuenow", String(Math.round(tick)))
      this.rulerTarget.setAttribute("aria-valuetext", `Compasso ${Math.floor(tick / 1920) + 1}, tempo ${Math.floor(tick % 1920 / 480) + 1}`)
    }
    if (this.hasCursorTextTarget) this.cursorTextTarget.textContent = `Compasso ${Math.floor(tick / 1920) + 1} · tempo ${(tick % 1920 / 480 + 1).toFixed(1)}`
    if (this.editor) { this.editor.currentTick = tick; this.editor.render(); }
    if (this.playbackStatus === "playing" && !this.seeking && this.hasRulerTarget) {
      const viewport = this.rulerTarget.parentElement, x = tick / 480 * this.beatPixels()
      if (x < viewport.scrollLeft || x > viewport.scrollLeft + viewport.clientWidth - 32) viewport.scrollLeft = Math.max(0, x - 40)
    }
  }

  /** Inicia gesto na régua musical; a captura permite terminar fora do elemento. */
  beginSeek(event) {
    if (event.button !== 0 && event.button !== undefined) return
    this.seeking = { previous: this.positionTick || 0, pointer: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId); this.moveSeek(event)
  }

  /** Converte pixels do conteúdo rolado em ticks, limitados pelo adaptador. */
  moveSeek(event) {
    if (!this.seeking) return
    const tick = (event.clientX - event.currentTarget.getBoundingClientRect().left) / this.beatPixels() * 480
    this.seekTo(tick)
  }

  /** Finaliza gesto; cancelamento restaura a posição anterior. */
  endSeek(event) { if (event.type === "pointercancel" && this.seeking) this.seekTo(this.seeking.previous); this.seeking = null }

  /** Oferece setas e limites absolutos sem capturar teclas de outros controles. */
  rulerKey(event) {
    const destinations = { ArrowLeft: this.positionTick - 120, ArrowRight: this.positionTick + 120, Home: 0, End: harmonyEnd(this.music) }
    if (!(event.key in destinations)) return
    event.preventDefault(); this.seekTo(destinations[event.key])
  }

  /** Recebe posição musical da régua do editor ativo. */
  editorSeek(event) { if (!this.editor || event.target === this.editor.element) this.seekTo(event.detail.tick) }

  /** Posiciona o transporte sem salvar o cursor; valor visual é imediatamente coerente. */
  seekTo(tick) {
    this.positionTick = Math.max(0, Math.min(harmonyEnd(this.music), Math.round(tick)))
    this.transport.seek?.(this.positionTick); this.renderCursor()
  }

  /** Salva a projeção com controle de versão e conserva edições feitas durante o envio. */
  async save() {
    if (!this.hasSaveUrlValue || this.saving || !this.dirty) return
    this.saving = true
    this.saveButtonTarget.disabled = true
    this.saveStatusTarget.textContent = "Salvando…"
    const revision = this.editRevision
    const connection = this.connectionRevision
    try {
      const response = await this.request(this.saveUrlValue, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify({ document: this.music, lock_version: this.lockVersionValue })
      })
      const result = await response.json()
      if (connection !== this.connectionRevision) return
      if (!response.ok) throw new Error(result.error || "Tente salvar novamente.")
      this.lockVersionValue = result.lock_version
      this.dirty = revision !== this.editRevision
      this.saveStatusTarget.textContent = this.dirty ? "Há novas alterações para salvar" : "Salvo"
    } catch (error) {
      if (connection === this.connectionRevision) this.saveStatusTarget.textContent = `Não foi salvo. ${error.message}`
    }
    finally {
      if (connection === this.connectionRevision) {
        this.saving = false
        this.saveButtonTarget.disabled = !this.dirty
      }
    }
  }
}
