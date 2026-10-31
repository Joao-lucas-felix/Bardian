import { Controller } from "@hotwired/stimulus"
import { Duration, Pitch, Rational, ScoreBuilder } from "@webmusic/score"
import * as Tone from "tone"
import { createPhraseInstrument } from "audio/phrase_instruments"

/**
 * Controla um editor de piano roll em Canvas, mantendo a música em ticks.
 *
 * A tela é apenas uma projeção do estado musical: mover ou ampliar o editor
 * altera a viewport, mas nunca converte as notas para coordenadas persistidas.
 * Uma semínima equivale a 480 ticks. Sem contexto externo, o rascunho mantém
 * quatro compassos 4/4; uma composição salva fornece duração e compasso.
 */
export default class extends Controller {
  static values = { initialNotes: Array, audioEnabled: { type: Boolean, default: true }, partName: { type: String, default: "Piano" }, layout: { type: String, default: "pitched" }, instrumentId: { type: String, default: "piano" }, totalTicks: Number, timeNumerator: Number, timeDenominator: Number, bpm: Number, persistentMode: Boolean }
  static targets = [
    "duration", "expandButton", "keyboard", "loopButton", "loopEndLine", "loopEndMarker",
    "loopStartLine", "loopStartMarker", "playhead", "ruler", "roll",
    "rollViewport", "score", "snapButton", "status", "velocity", "velocityInput", "zoomLabel"
  ]

  /** Inicializa o estado musical, a viewport e os listeners do editor. */
  connect() {
    this.ticksPerQuarter = 480
    this.totalTicks = this.hasTotalTicksValue ? this.totalTicksValue : this.ticksPerQuarter * 16
    this.timeNumerator = this.hasTimeNumeratorValue ? this.timeNumeratorValue : 4
    this.timeDenominator = this.hasTimeDenominatorValue ? this.timeDenominatorValue : 4
    this.currentBpm = this.hasBpmValue ? this.bpmValue : 120
    this.minPitch = this.isPersistentMode() ? 0 : 36
    this.maxPitch = this.isPersistentMode() ? 127 : 84
    this.rowHeight = this.initialRowHeight()
    this.pixelsPerQuarter = Math.round(this.initialZoom() * 88)
    this.zoomLabelTarget.textContent = `${Math.round(this.initialZoom() * 100)}%`
    this.gridQuarter = 1
    this.snapEnabled = true
    this.notes = []
    this.selectedNoteIds = new Set()
    this.outOfContextNoteIds = new Set()
    this.nextNoteId = 1
    this.loadInitialNotes()
    this.keyboardCursor = { pitch: this.isDrumLayout() ? 38 : 60, onset: 0 }
    this.partId = null
    this.interaction = null
    this.playbackFrame = null
    this.playbackStartedAt = null
    this.playbackAudioStartAt = null
    this.playbackDuration = 0
    this.playbackGeneration = 0
    this.isPlaying = false
    this.playbackPending = false
    this.lastSpaceAt = null
    this.loopEnabled = true
    this.loopStartTick = 0
    this.loopEndTick = this.totalTicks
    this.loopDrag = null
    this.score = this.buildScore()

    this.bindCanvasEvents()
    this.buildKeyboard()
    this.resizeCanvases()
    this.revealInitialPitch()
    this.render()
    this.watchTheme()
    this.updateSummary()
    // O shell externo recebe somente a disponibilidade; as notas já vieram em valores.
    this.dispatch("ready")
  }

  /** Repinta apenas o editor persistido quando o usuário troca o tema global. */
  watchTheme() {
    if (!this.isPersistentMode()) return
    this.themeObserver = new MutationObserver(() => this.render())
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  }

  /** Amplia ou restaura a mesma superfície, sem recriar notas ou o controller. */
  toggleExpanded() {
    if (this.element.classList.contains("is-expanded")) this.closeExpanded()
    else this.openExpanded()
  }

  /** Isola o editor visualmente e tira do foco os irmãos de cada ancestral. */
  openExpanded() {
    if (!this.hasExpandButtonTarget || this.element.classList.contains("is-expanded")) return
    this.backgroundInert = []
    for (let child = this.element; child?.parentElement; child = child.parentElement) {
      for (const sibling of child.parentElement.children || []) {
        if (sibling === child) continue
        this.backgroundInert.push([sibling, sibling.inert])
        sibling.inert = true
      }
    }
    this.previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    this.element.classList.add("is-expanded")
    this.element.setAttribute("role", "dialog")
    this.element.setAttribute("aria-modal", "true")
    this.expandButtonTarget.textContent = "Restaurar"
    this.expandButtonTarget.setAttribute("aria-expanded", "true")
    this.expandButtonTarget.setAttribute("aria-label", "Restaurar tamanho do piano roll")
    this.expandButtonTarget.focus()
    this.resizeCanvases()
  }

  /**
   * Recoloca a página e a viewport em seu estado anterior, conservando a seleção.
   * @param {{restoreFocus?: boolean, resize?: boolean}} options Evita foco e Canvas ao desmontar a view.
   */
  closeExpanded({ restoreFocus = true, resize = true } = {}) {
    if (!this.element.classList.contains("is-expanded")) return
    this.element.classList.remove("is-expanded")
    this.element.removeAttribute("role")
    this.element.removeAttribute("aria-modal")
    for (const [element, wasInert] of this.backgroundInert || []) element.inert = wasInert
    this.backgroundInert = null
    document.body.style.overflow = this.previousBodyOverflow
    this.expandButtonTarget.textContent = "Expandir"
    this.expandButtonTarget.setAttribute("aria-expanded", "false")
    this.expandButtonTarget.setAttribute("aria-label", "Expandir piano roll para tela toda")
    if (restoreFocus) this.expandButtonTarget.focus()
    if (resize) this.resizeCanvases()
  }

  /** Captura Esc antes do atalho da grade, que limparia a seleção de notas.
   * @param {KeyboardEvent} event Tecla pressionada no documento.
   */
  handleExpandedKeyDown(event) {
    if (!this.element.classList.contains("is-expanded") || event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    this.closeExpanded()
  }

  /** Copia notas recebidas da frase ativa e reserva IDs para novas notas. */
  loadInitialNotes() {
    if (!Array.isArray(this.initialNotesValue)) return
    this.notes = this.initialNotesValue.filter((note) =>
      typeof note.id === "string" && Number.isInteger(note.pitch) && this.displayPitches().includes(note.pitch) &&
      Number.isInteger(note.onset) && note.onset >= 0 && Number.isInteger(note.duration) && note.duration > 0 &&
      note.onset + note.duration <= this.totalTicks && Number.isInteger(note.velocity) && note.velocity >= 1 && note.velocity <= 127
    ).map((note) => ({ id: note.id, pitch: note.pitch, onset: note.onset, duration: note.duration, velocity: note.velocity }))
    this.nextNoteId = this.notes.reduce((next, note) => {
      const match = /^note-(\d+)$/.exec(note.id)
      return match ? Math.max(next, Number(match[1]) + 1) : next
    }, 1)
  }

  /** Devolve uma cópia transportável das notas para a página de criação. */
  snapshotNotes() {
    return this.notes.map(({ id, pitch, onset, duration, velocity }) => ({ id, pitch, onset, duration, velocity }))
  }

  /** Solicita à composição um ID global; no rascunho mantém a sequência legada. */
  nextNoteIdForEditor() {
    if (!this.isPersistentMode()) return `note-${this.nextNoteId++}`
    const detail = { id: null }
    this.element.dispatchEvent(new CustomEvent("piano-roll:request-note-id", { bubbles: true, detail }))
    if (typeof detail.id !== "string" || !detail.id || this.notes.some((note) => note.id === detail.id)) {
      throw new Error("ID global de nota não fornecido pela composição")
    }
    return detail.id
  }

  /** Restaura um snapshot do histórico sem gerar outra alteração ou ponto de desfazer. */
  replaceNotes(notes) {
    this.notes = notes.map((note) => ({ ...note }))
    this.selectedNoteIds.clear()
    this.score = this.buildScore()
    this.render()
    this.updateSummary()
  }

  /** Encaminha seek ao shell quando o editor usa transporte externo. */
  beginExternalSeek(event) {
    if (this.audioAvailable()) return
    this.externalSeek = { previous: this.currentTick || 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
    this.moveExternalSeek(event)
  }

  /** Usa a escala atual do canvas; seu retângulo já incorpora a rolagem horizontal. */
  moveExternalSeek(event) {
    if (!this.externalSeek) return
    const tick = this.pixelsToMusic(event.clientX - event.currentTarget.getBoundingClientRect().left)
    this.dispatch("seek", { detail: { tick } })
  }

  /** Cancela o gesto restaurando o tick anterior sem modificar notas. */
  endExternalSeek(event) {
    if (this.externalSeek && event.type === "pointercancel") this.dispatch("seek", { detail: { tick: this.externalSeek.previous } })
    this.externalSeek = null
  }

  /** Recebe IDs da análise tonal para pintar alertas sem modificar eventos MIDI. */
  setOutOfContextNotes(ids) {
    this.outOfContextNoteIds = new Set(ids)
    this.render()
  }

  /** Publica somente alterações reais e finalizadas, para um ponto de histórico por gesto. */
  confirmNotesChanged(previous) {
    if (JSON.stringify(previous) !== JSON.stringify(this.snapshotNotes())) {
      this.dispatch("notes-committed", { detail: { notes: this.snapshotNotes() } })
    }
  }

  /** Preserva reprodução no protótipo que não declara o valor Stimulus. */
  audioAvailable() { return this.hasAudioEnabledValue ? this.audioEnabledValue : true }

  /** Distingue a composição salva do rascunho sem mudar seu comportamento legado. */
  isPersistentMode() { return this.hasPersistentModeValue && this.persistentModeValue }

  /** Calcula um compasso no denominador declarado, sempre em ticks musicais. */
  numerator() { return this.timeNumerator ?? (this.hasTimeNumeratorValue ? this.timeNumeratorValue : 4) }
  denominator() { return this.timeDenominator ?? (this.hasTimeDenominatorValue ? this.timeDenominatorValue : 4) }
  bpm() { return this.currentBpm ?? (this.hasBpmValue ? this.bpmValue : 120) }
  /** Converte um tick para segundos usando o andamento da composição. */
  secondsPerTick() { return 60 / this.bpm() / this.ticksPerQuarter }
  measureTicks() {
    return this.ticksPerQuarter * 4 / this.denominator() * this.numerator()
  }

  /** Atualiza régua e limite quando a região ou o compasso muda, sem retimar notas. */
  setMusicalContext({ totalTicks, numerator, denominator, bpm = this.bpm() }) {
    if (!Number.isInteger(totalTicks) || totalTicks < 1 || !Number.isInteger(numerator) || numerator < 1 ||
      ![1, 2, 4, 8, 16, 32, 64].includes(denominator) || !Number.isInteger(bpm) || bpm < 1 ||
      this.notes.some((note) => note.onset + note.duration > totalTicks)) {
      throw new Error("Contexto musical inválido para esta região")
    }
    if (bpm !== this.bpm() && (this.isPlaying || this.playbackPending)) this.stop()
    const loopAtEnd = this.loopEndTick === this.totalTicks
    this.totalTicks = totalTicks
    this.timeNumerator = numerator
    this.timeDenominator = denominator
    this.currentBpm = bpm
    this.loopStartTick = Math.min(this.loopStartTick, Math.max(0, totalTicks - 1))
    this.loopEndTick = loopAtEnd ? totalTicks : Math.min(totalTicks, Math.max(this.loopStartTick + 1, this.loopEndTick))
    this.score = this.buildScore()
    this.resizeCanvases()
    this.updateSummary()
  }

  /** Define as alturas desenhadas; bateria usa linhas por peça, não cromatismo. */
  displayPitches() {
    if (this.isDrumLayout()) {
      const pitches = [42, 38, 36]
      if (this.isPersistentMode()) {
        for (const note of [...(this.initialNotesValue || []), ...this.notes]) {
          if (Number.isInteger(note.pitch) && note.pitch >= 0 && note.pitch <= 127) pitches.push(note.pitch)
        }
      }
      return [...new Set(pitches)].sort((a, b) => b - a)
    }
    const minimum = this.isPersistentMode() ? 0 : this.minPitch
    const maximum = this.isPersistentMode() ? 127 : this.maxPitch
    return Array.from({ length: maximum - minimum + 1 }, (_, index) => maximum - index)
  }

  /** Identifica o modo de três peças sem alterar o protótipo isolado. */
  isDrumLayout() { return this.hasLayoutValue && this.layoutValue === "drums" }

  /** Enquadra mais compassos ao abrir uma composição, mantendo o protótipo em 100%. */
  initialZoom() { return this.isPersistentMode() ? 0.75 : 1 }

  /** Exibe mais alturas por janela no editor persistido sem mudar os pitches. */
  initialRowHeight() { return this.isPersistentMode() ? 18 : 22 }

  /** Registra os gestos do Canvas e mantém a renderização responsiva. */
  bindCanvasEvents() {
    this.onPointerDown = this.pointerDown.bind(this)
    this.onPointerMove = this.pointerMove.bind(this)
    this.onPointerUp = this.pointerUp.bind(this)
    this.onPointerCancel = this.pointerCancel.bind(this)
    this.onNoteContextMenu = this.handleNoteContextMenu.bind(this)
    this.onResize = this.resizeCanvases.bind(this)
    this.onScroll = this.syncViewport.bind(this)
    this.onWheel = this.handleWheel.bind(this)
    this.onKeyDown = this.handleKeyDown.bind(this)
    this.onTransportKeyDown = this.handleTransportKeyDown.bind(this)
    this.onExpandedKeyDown = this.handleExpandedKeyDown.bind(this)
    this.onRollFocus = () => {
      this.statusTarget.textContent = this.keyboardCursorStatus()
      this.render()
    }
    this.onRollBlur = () => this.render()

    this.rollTarget.addEventListener("pointerdown", this.onPointerDown)
    this.rollTarget.addEventListener("pointermove", this.onPointerMove)
    window.addEventListener("pointerup", this.onPointerUp)
    this.rollTarget.addEventListener("pointercancel", this.onPointerCancel)
    this.rollTarget.addEventListener("contextmenu", this.onNoteContextMenu)
    window.addEventListener("resize", this.onResize)
    this.rollViewportTarget.addEventListener("scroll", this.onScroll)
    this.keyboardTarget.addEventListener("wheel", this.onWheel, { passive: false })
    this.rulerTarget.addEventListener("wheel", this.onWheel, { passive: false })
    this.velocityTarget.addEventListener("wheel", this.onWheel, { passive: false })
    this.rollViewportTarget.addEventListener("wheel", this.onWheel, { passive: false })
    this.rollTarget.addEventListener("keydown", this.onKeyDown)
    this.rollTarget.addEventListener("focus", this.onRollFocus)
    this.rollTarget.addEventListener("blur", this.onRollBlur)
    window.addEventListener("keydown", this.onTransportKeyDown)
    if (this.hasExpandButtonTarget) window.addEventListener("keydown", this.onExpandedKeyDown, true)
  }

  /** Converte o estado atual para o Score imutável usado pelo domínio musical. */
  buildScore() {
    const builder = new ScoreBuilder()
    const partId = builder.newPartId()
    this.partId = partId

    builder.setMetadata({ title: "Composição de demonstração", composer: "Bardian" })
    builder.addPart({ id: partId, name: this.partNameValue || "Piano", midiProgram: 0 })
    for (let start = 0, number = 1; start < this.totalTicks; start += this.measureTicks(), number += 1) {
      const duration = Math.min(this.measureTicks(), this.totalTicks - start)
      builder.addMeasure({
        id: builder.newMeasureId(),
        number,
        onsetQuarters: this.quarters(start),
        durationQuarters: this.quarters(duration),
        timeSignature: { numerator: this.numerator(), denominator: this.denominator() }
      })
    }

    this.notes.forEach((note) => {
      builder.addNote(partId, {
        id: note.id,
        pitch: Pitch.fromMidi(note.pitch),
        onsetQuarters: new Rational(note.onset, this.ticksPerQuarter),
        duration: new Duration({ base: new Rational(note.duration, this.ticksPerQuarter) }),
        velocity: note.velocity
      })
    })

    return builder.build()
  }

  /** Reduz a fração de ticks em semínimas para o ScoreBuilder. */
  quarters(ticks) {
    let divisor = this.ticksPerQuarter
    let value = ticks
    while (value !== 0) [value, divisor] = [divisor % value, value]
    return new Rational(ticks / divisor, this.ticksPerQuarter / divisor)
  }

  /** Cria as teclas virtuais e permite ouvir uma altura isolada. */
  buildKeyboard() {
    const audioEnabled = this.audioAvailable()
    this.keyList = document.createElement("div")
    this.keyList.className = "piano-roll-key-list"
    for (const pitch of this.displayPitches()) {
      const key = document.createElement(audioEnabled ? "button" : "div")
      if (audioEnabled) key.type = "button"
      key.className = `piano-roll-key ${this.isBlackKey(pitch) ? "is-black" : "is-white"}`
      key.dataset.pitch = pitch
      key.textContent = this.pitchName(pitch)
      if (audioEnabled) {
        key.setAttribute("aria-label", `Ouvir ${this.pitchName(pitch)}, MIDI ${pitch}`)
        key.addEventListener("click", () => this.previewPitch(pitch))
      }
      this.keyList.append(key)
    }
    this.keyboardTarget.setAttribute("aria-hidden", String(!audioEnabled))
    this.keyboardTarget.replaceChildren(this.keyList)
  }

  /** Centraliza a primeira nota (ou Dó4) ao abrir a grade MIDI completa. */
  revealInitialPitch() {
    if (!this.isPersistentMode() || this.isDrumLayout()) return
    const pitch = this.notes[0]?.pitch ?? 60
    this.rollViewportTarget.scrollTop = Math.max(0, this.pitchToPixels(pitch) - this.rollViewportTarget.clientHeight / 2)
    this.syncViewport()
  }

  /** Estende os três Canvas até a borda visível sem alterar a duração musical. */
  resizeCanvases() {
    const width = Math.max(720, this.rollViewportTarget?.clientWidth || 0, this.totalTicks / this.ticksPerQuarter * this.pixelsPerQuarter)
    const height = this.displayPitches().length * this.rowHeight
    this.canvasSize(this.rollTarget, width, height)
    this.canvasSize(this.rulerTarget, width, 36)
    this.canvasSize(this.velocityTarget, width, this.velocityTarget.parentElement?.clientHeight || 92)
    // A agulha pertence ao conteúdo rolável, não apenas à janela visível da grade.
    this.playheadTarget.style.height = `${height}px`
    this.loopStartLineTarget.style.height = `${height}px`
    this.loopEndLineTarget.style.height = `${height}px`
    this.keyboardTarget.style.setProperty("--piano-roll-row-height", `${this.rowHeight}px`)
    this.syncViewport()
    this.render()
  }

  /** Define o tamanho físico do Canvas respeitando o pixel ratio do dispositivo. */
  canvasSize(canvas, width, height) {
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  /** Desenha grade, notas, teclado auxiliar, velocity e playhead. */
  render() {
    if (!this.hasRollTarget || !this.rollTarget.width) return
    this.drawRoll()
    this.drawRuler()
    this.drawVelocity()
    this.playheadTarget.style.left = `${this.musicToPixels(this.currentTick || 0)}px`
    this.syncLoopMarkers()
  }

  /**
   * Lê a paleta da superfície ativa para que o Canvas acompanhe o tema e os
   * tokens visuais da página de composição, sem fixar cores na lógica MIDI.
   */
  canvasColors() {
    const style = getComputedStyle(this.element)
    const color = (name, fallback) => style.getPropertyValue(`--piano-roll-${name}`).trim() || fallback
    return {
      grid: color("grid-bg", "#f9fbfb"), row: color("grid-row", "#eef2f3"),
      strongLine: color("strong-line", "#b9c9ce"), line: color("line", "#dce5e7"),
      measure: color("measure-line", "#b6c8cc"), beat: color("beat-line", "#e1e9ea"),
      ruler: color("ruler-bg", "#f2f6f6"), rulerText: color("ruler-text", "#385c65"),
      beatText: color("beat-text", "#71858b"), velocity: color("velocity-bg", "#f7fafa"),
      inactiveLoop: color("inactive-loop", "rgba(36, 55, 65, .09)"),
      note: color("note", "#54a89a"), noteBorder: color("note-border", "#28786e"), noteText: color("note-text", "#164c45"),
      selectedNote: color("selected-note", "#d79b5d"), selectedNoteBorder: color("selected-note-border", "#8a572d"),
      selectedNoteText: color("selected-note-text", "#5b381d"),
      outsideNote: color("outside-note", "#d18d38"), outsideNoteBorder: color("outside-note-border", "#765119"),
      playhead: color("playhead", "#b93830"),
      selection: color("selection", "rgba(47, 109, 125, .16)"), selectionBorder: color("selected-note-border", "#2f6d7d")
    }
  }

  /** Desenha o corpo principal em camadas previsíveis para facilitar manutenção. */
  drawRoll() {
    const context = this.rollTarget.getContext("2d")
    const colors = this.canvasColors()
    const width = this.rollTarget.clientWidth
    const height = this.rollTarget.clientHeight
    context.clearRect(0, 0, width, height)
    context.fillStyle = colors.grid
    context.fillRect(0, 0, width, height)

    for (const pitch of this.displayPitches()) {
      const y = this.pitchToPixels(pitch)
      context.fillStyle = !this.isDrumLayout() && this.isBlackKey(pitch) ? colors.row : colors.grid
      context.fillRect(0, y, width, this.rowHeight)
      context.strokeStyle = pitch % 12 === 0 ? colors.strongLine : colors.line
      context.lineWidth = pitch % 12 === 0 ? 1.2 : 1
      context.beginPath()
      context.moveTo(0, y + this.rowHeight)
      context.lineTo(width, y + this.rowHeight)
      context.stroke()
    }

    for (let tick = 0; tick <= this.totalTicks; tick += this.gridTicks()) {
      const x = this.musicToPixels(tick)
      const major = tick % this.measureTicks() === 0
      context.strokeStyle = major ? colors.measure : colors.beat
      context.lineWidth = major ? 1.4 : 1
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, height)
      context.stroke()
    }

    // A região escurecida permanece editável; apenas destaca o que não será ouvido.
    context.fillStyle = colors.inactiveLoop
    context.fillRect(0, 0, this.musicToPixels(this.loopStartTick), height)
    context.fillRect(this.musicToPixels(this.loopEndTick), 0, width - this.musicToPixels(this.loopEndTick), height)

    this.notes.forEach((note) => this.drawNote(context, note))
    if (document.activeElement === this.rollTarget) {
      context.strokeStyle = colors.playhead
      context.lineWidth = 3
      context.strokeRect(this.musicToPixels(this.keyboardCursor.onset) + 2, this.pitchToPixels(this.keyboardCursor.pitch) + 2, this.musicToPixels(this.gridTicks()) - 4, this.rowHeight - 4)
    }
    if (this.interaction?.type === "marquee" && this.interaction.currentPoint) {
      const { point, currentPoint } = this.interaction
      const x = Math.min(point.x, currentPoint.x)
      const y = Math.min(point.y, currentPoint.y)
      const width = Math.abs(point.x - currentPoint.x)
      const height = Math.abs(point.y - currentPoint.y)
      context.fillStyle = colors.selection
      context.strokeStyle = colors.selectionBorder
      context.lineWidth = 1
      context.fillRect(x, y, width, height)
      context.strokeRect(x, y, width, height)
    }
  }

  /** Desenha a nota e evidencia as alças de duração quando ela está selecionada. */
  drawNote(context, note) {
    const colors = this.canvasColors()
    const x = this.musicToPixels(note.onset) + 2
    const y = this.pitchToPixels(note.pitch) + 3
    const width = Math.max(6, this.musicToPixels(note.onset + note.duration) - this.musicToPixels(note.onset) - 4)
    const selected = this.selectedNoteIds.has(note.id)
    const outside = this.outOfContextNoteIds?.has(note.id)
    context.fillStyle = selected ? colors.selectedNote : (outside ? colors.outsideNote : colors.note)
    context.strokeStyle = outside ? colors.outsideNoteBorder : (selected ? colors.selectedNoteBorder : colors.noteBorder)
    context.lineWidth = selected ? 2 : 1
    context.beginPath()
    context.roundRect(x, y, width, this.rowHeight - 6, 4)
    context.fill()
    context.stroke()
    if (outside) {
      context.fillStyle = colors.outsideNoteBorder
      context.font = "800 11px system-ui"
      context.fillText("!", x + 4, y + 14)
    }
    if (selected && width >= 22) {
      context.fillStyle = colors.selectedNoteText
      context.fillRect(x + 6, y + 4, 2, this.rowHeight - 14)
      context.fillRect(x + width - 8, y + 4, 2, this.rowHeight - 14)
    }
    if (width >= 34) {
      context.fillStyle = selected ? colors.selectedNoteText : colors.noteText
      context.font = "600 10px system-ui"
      context.fillText(this.pitchName(note.pitch), x + 12, y + 14, width - 24)
    }
  }

  /** Desenha a régua com compassos e tempos sem acoplar o estado aos pixels. */
  drawRuler() {
    const context = this.rulerTarget.getContext("2d")
    const colors = this.canvasColors()
    const width = this.rulerTarget.clientWidth
    context.clearRect(0, 0, width, 36)
    context.fillStyle = colors.ruler
    context.fillRect(0, 0, width, 36)
    context.fillStyle = colors.inactiveLoop
    context.fillRect(0, 0, this.musicToPixels(this.loopStartTick), 36)
    context.fillRect(this.musicToPixels(this.loopEndTick), 0, width - this.musicToPixels(this.loopEndTick), 36)
    context.font = "600 11px system-ui"
    const beatTicks = this.ticksPerQuarter * 4 / this.denominator()
    for (let tick = 0; tick < this.totalTicks; tick += beatTicks) {
      const x = this.musicToPixels(tick)
      const measure = Math.floor(tick / this.measureTicks()) + 1
      const beat = Math.floor((tick % this.measureTicks()) / beatTicks) + 1
      context.fillStyle = beat === 1 ? colors.rulerText : colors.beatText
      context.fillText(beat === 1 ? `Compasso ${measure}` : String(beat), x + 8, 22)
    }
  }

  /** Desenha a lane inferior com a intensidade MIDI de cada nota. */
  drawVelocity() {
    const context = this.velocityTarget.getContext("2d")
    const colors = this.canvasColors()
    const width = this.velocityTarget.clientWidth
    const height = this.velocityTarget.clientHeight
    context.clearRect(0, 0, width, height)
    context.fillStyle = colors.velocity
    context.fillRect(0, 0, width, height)
    this.notes.forEach((note) => {
      const x = this.musicToPixels(note.onset) + 4
      const barWidth = Math.max(4, this.musicToPixels(note.duration) - 8)
      const barHeight = Math.max(4, (note.velocity / 127) * Math.max(8, height - 16))
      context.fillStyle = this.selectedNoteIds.has(note.id) ? colors.selectedNote : colors.note
      context.fillRect(x, height - barHeight - 4, barWidth, barHeight)
    })
  }

  /** Inicia desenho de nota, seleção, movimento ou redimensionamento. */
  pointerDown(event) {
    if (event.button !== 0) return
    event.preventDefault()
    this.rollTarget.focus({ preventScroll: true })
    const point = this.pointerPoint(event)
    const selectionBefore = new Set(this.selectedNoteIds)
    const note = this.noteAt(point)
    const edge = note && this.noteEdge(point, note)
    this.rollTarget.setPointerCapture?.(event.pointerId)

    if (note) {
      if (event.shiftKey) {
        this.toggleSelection(note.id)
      } else if (!this.selectedNoteIds.has(note.id)) {
        this.selectOnly(note.id)
      }
      if (this.selectedNoteIds.has(note.id)) {
        this.interaction = { type: edge || "move", point, noteIds: edge ? [note.id] : [...this.selectedNoteIds], snapshot: this.snapshotSelection(), snapshotNotes: this.snapshotNotes(), selectionBefore: new Set(this.selectedNoteIds) }
      }
      this.render()
      this.updateSummary()
      return
    }

    if (event.shiftKey) {
      this.interaction = { type: "marquee", point, currentPoint: point, baseSelection: new Set(this.selectedNoteIds) }
      this.render()
      return
    }

    this.selectedNoteIds.clear()
    const duration = Math.min(this.gridTicks(), this.totalTicks)
    const onset = Math.max(0, Math.min(this.totalTicks - duration, this.snapTick(this.pixelsToMusic(point.x))))
    const pitch = this.pixelsToPitch(point.y)
    const beforeNotes = this.snapshotNotes()
    const noteData = { id: this.nextNoteIdForEditor(), pitch, onset, duration, velocity: 100 }
    this.notes.push(noteData)
    this.selectOnly(noteData.id)
    this.interaction = { type: "draw", point, noteId: noteData.id, snapshot: { ...noteData }, beforeNotes, selectionBefore }
    this.commitScore()
    this.render()
    this.updateSummary()
  }

  /**
   * Exclui apenas a nota sob o clique direito e conserva o menu nativo na grade vazia.
   * @param {MouseEvent} event Clique de contexto com coordenadas da grade.
   */
  handleNoteContextMenu(event) {
    const note = this.noteAt(this.pointerPoint(event))
    if (!note) return
    event.preventDefault()
    const previous = this.snapshotNotes()
    this.notes = this.notes.filter((item) => item.id !== note.id)
    this.selectedNoteIds.delete(note.id)
    this.commitScore()
    this.confirmNotesChanged(previous)
    this.render()
    this.updateSummary()
  }

  /** Atualiza a nota ativa durante um gesto contínuo. */
  pointerMove(event) {
    const point = this.pointerPoint(event)
    if (!this.interaction) {
      const note = this.noteAt(point)
      this.rollTarget.style.cursor = note ? (this.noteEdge(point, note) ? "ew-resize" : "move") : "crosshair"
      return
    }
    const interaction = this.interaction

    if (interaction.type === "marquee") {
      interaction.currentPoint = point
      this.selectedNoteIds = new Set([...interaction.baseSelection, ...this.notesInMarquee(interaction.point, point)])
    } else if (interaction.type === "draw") {
      const note = this.notes.find((item) => item.id === interaction.noteId)
      if (!note) return
      const end = Math.max(note.onset + Math.min(this.gridTicks(), this.totalTicks - note.onset), this.snapTick(this.pixelsToMusic(point.x)))
      note.duration = Math.min(this.totalTicks - note.onset, end - note.onset)
    } else if (interaction.type === "move") {
      const requestedTick = this.snapEnabled
        ? this.snapTick(this.pixelsToMusic(point.x) - this.pixelsToMusic(interaction.point.x))
        : Math.round(this.pixelsToMusic(point.x) - this.pixelsToMusic(interaction.point.x))
      const requestedPitch = Math.round((interaction.point.y - point.y) / this.rowHeight)
      const originals = interaction.noteIds.map((id) => interaction.snapshot[id]).filter(Boolean)
      const deltaTick = Math.max(-Math.min(...originals.map((note) => note.onset)), Math.min(this.totalTicks - Math.max(...originals.map((note) => note.onset + note.duration)), requestedTick))
      const deltaPitch = Math.max(this.minPitch - Math.min(...originals.map((note) => note.pitch)), Math.min(this.maxPitch - Math.max(...originals.map((note) => note.pitch)), requestedPitch))
      interaction.noteIds.forEach((id) => {
        const original = interaction.snapshot[id]
        const note = this.notes.find((item) => item.id === id)
        if (!note || !original) return
        note.onset = original.onset + deltaTick
        if (this.isDrumLayout()) {
          const rows = this.displayPitches()
          note.pitch = rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(original.pitch) - requestedPitch))]
        } else note.pitch = original.pitch + deltaPitch
      })
    } else if (interaction.type === "resize-right") {
      const note = this.notes.find((item) => item.id === interaction.noteIds[0])
      if (note) {
        const remaining = this.totalTicks - note.onset
        note.duration = Math.max(Math.min(this.gridTicks(), remaining), Math.min(remaining, this.snapTick(this.pixelsToMusic(point.x)) - note.onset))
      }
    } else if (interaction.type === "resize-left") {
      const note = this.notes.find((item) => item.id === interaction.noteIds[0])
      if (note) {
        const end = interaction.snapshot[note.id].onset + interaction.snapshot[note.id].duration
        const onset = Math.max(0, Math.min(end - this.gridTicks(), this.snapTick(this.pixelsToMusic(point.x))))
        note.onset = onset
        note.duration = end - onset
      }
    }

    this.render()
    this.updateSummary()
  }

  /** Finaliza o gesto e atualiza o Score apenas uma vez por operação. */
  pointerUp(event) {
    if (!this.interaction) return
    if (event?.pointerId != null && this.rollTarget.hasPointerCapture?.(event.pointerId)) this.rollTarget.releasePointerCapture(event.pointerId)
    const previous = this.interaction.beforeNotes || this.interaction.snapshotNotes
    this.interaction = null
    this.commitScore()
    if (previous) this.confirmNotesChanged(previous)
    this.render()
    this.updateSummary()
  }

  /** Cancela gesto interrompido, restaura notas e publica o estado para reanálise. */
  pointerCancel(event) {
    if (!this.interaction) return
    if (event?.pointerId != null && this.rollTarget.hasPointerCapture?.(event.pointerId)) this.rollTarget.releasePointerCapture(event.pointerId)
    const interaction = this.interaction
    this.interaction = null
    if (interaction.type === "marquee") {
      this.selectedNoteIds = new Set(interaction.baseSelection)
    } else {
      const current = this.snapshotNotes()
      this.notes = (interaction.beforeNotes || interaction.snapshotNotes).map((note) => ({ ...note }))
      this.selectedNoteIds = new Set(interaction.selectionBefore || [])
      if (JSON.stringify(current) !== JSON.stringify(this.snapshotNotes())) {
        this.commitScore()
        this.confirmNotesChanged(current)
      }
    }
    this.render()
    this.updateSummary()
  }

  /** Retoma do tick da agulha e agenda notas no relógio do Tone.js. */
  async play() {
    if (!this.audioAvailable()) {
      this.statusTarget.textContent = "O áudio desta frase está indisponível."
      return
    }
    if (!this.notes.length) {
      this.statusTarget.textContent = "Adicione uma nota antes de reproduzir"
      return
    }
    // A timeline hospedeira pausa sua reprodução antes que a prévia assuma o áudio.
    this.dispatch("playback-started")
    const resumeTick = this.currentTick >= this.loopStartTick && this.currentTick < this.loopEndTick ? this.currentTick : this.loopStartTick
    this.stop()
    this.currentTick = resumeTick
    this.playheadTarget.style.left = `${this.musicToPixels(resumeTick)}px`
    const generation = this.playbackGeneration
    this.playbackPending = true
    try {
      await Tone.start()
      if (generation !== this.playbackGeneration) return
      await this.loadInstrument()
      if (generation !== this.playbackGeneration) return
      this.playbackDuration = (this.loopEndTick - this.loopStartTick) * this.secondsPerTick()
      this.nextCycleAt = Tone.now() + 0.05
      this.playbackAudioStartAt = this.nextCycleAt
      this.nextCycleTick = resumeTick
      this.playbackStartedAt = this.nextCycleAt - (resumeTick - this.loopStartTick) * this.secondsPerTick()
      this.isPlaying = true
      this.playbackPending = false
      this.scheduleAhead(Tone.now())
      if (this.loopEnabled) this.loopTimer = setInterval(() => this.scheduleAhead(Tone.now()), 25)
      this.statusTarget.textContent = this.loopEnabled ? "Reproduzindo em loop" : "Reproduzindo intervalo"
      this.animatePlayhead()
    } catch {
      if (generation === this.playbackGeneration) {
        this.stop()
        this.statusTarget.textContent = "Não foi possível iniciar o áudio. Tente novamente."
      }
    }
  }

  /** Carrega o timbre escolhido uma vez por instância ativa do editor. */
  async loadInstrument() {
    this.instrument ??= createPhraseInstrument(this.instrumentIdValue || "piano")
    const instrument = this.instrument
    try {
      await instrument.load()
    } catch (error) {
      instrument.dispose()
      if (this.instrument === instrument) this.instrument = null
      throw error
    }
  }

  /**
   * Converte notas em eventos relativos ao trecho do ciclo que será tocado.
   * A retomada inclui o restante de notas já iniciadas dentro do loop;
   * notas anteriores ao marcador inicial continuam fora da reprodução.
   * @param {number} startTick Primeiro tick do trecho a agendar.
   * @returns {Array<{pitch: number, offsetSeconds: number, durationSeconds: number}>}
   */
  loopEvents(startTick = this.loopStartTick) {
    const secondsPerTick = this.secondsPerTick()
    return this.notes.filter((note) => note.onset >= this.loopStartTick && note.onset < this.loopEndTick && note.onset + note.duration > startTick).map((note) => ({
      pitch: note.pitch,
      offsetSeconds: (Math.max(note.onset, startTick) - startTick) * secondsPerTick,
      durationSeconds: (Math.min(note.onset + note.duration, this.loopEndTick) - Math.max(note.onset, startTick)) * secondsPerTick
    }))
  }

  /**
   * Agenda os próximos eventos no relógio do Tone.js com 200 ms de antecedência.
   * @param {number} now Tempo atual em segundos no contexto de áudio.
   * Abas suspensas saltam ciclos perdidos em vez de disparar notas atrasadas.
   */
  scheduleAhead(now) {
    if (!this.isPlaying) return
    if (this.nextCycleAt < now && this.nextCycleTick !== this.loopStartTick) {
      this.nextCycleAt += (this.loopEndTick - this.nextCycleTick) * this.secondsPerTick()
      this.nextCycleTick = this.loopStartTick
    }
    if (this.nextCycleAt < now) {
      const missed = Math.ceil((now - this.nextCycleAt) / this.playbackDuration)
      this.nextCycleAt += missed * this.playbackDuration
    }
    while (this.nextCycleAt < now + 0.2) {
      const cycleAt = this.nextCycleAt
      this.loopEvents(this.nextCycleTick).forEach((event) => this.instrument.trigger(
        event.pitch, event.durationSeconds, cycleAt + event.offsetSeconds
      ))
      this.nextCycleAt += (this.loopEndTick - this.nextCycleTick) * this.secondsPerTick()
      this.nextCycleTick = this.loopStartTick
      if (!this.loopEnabled) break
    }
  }

  /**
   * Para o áudio agendado. O Espaço simples preserva a agulha; o botão Parar
   * e o Espaço duplo a devolvem ao início do intervalo.
   * @param {{preservePlayhead?: boolean}} options Define se a posição visual é mantida.
   */
  stop({ preservePlayhead = false } = {}) {
    if (preservePlayhead && this.isPlaying) this.currentTick = this.playheadTickAt(Tone.now())
    this.playbackGeneration = (this.playbackGeneration || 0) + 1
    if (this.playbackFrame) cancelAnimationFrame(this.playbackFrame)
    this.playbackFrame = null
    if (this.loopTimer) clearInterval(this.loopTimer)
    this.loopTimer = null
    this.isPlaying = false
    this.playbackPending = false
    this.instrument?.dispose()
    this.instrument = null
    if (!preservePlayhead) this.currentTick = this.loopStartTick || 0
    this.playheadTarget.style.left = `${this.musicToPixels(this.currentTick)}px`
    this.statusTarget.textContent = preservePlayhead ? "Reprodução pausada" : "Reprodução parada"
  }

  /**
   * Calcula a posição da agulha no ciclo atual, em ticks musicais.
   * @param {number} now Tempo atual em segundos no contexto de áudio.
   * @returns {number} Posição entre os marcadores, fixa no tick de retomada até o áudio começar.
   */
  playheadTickAt(now) {
    const elapsed = Math.max(0, Math.max(now, this.playbackAudioStartAt ?? now) - this.playbackStartedAt)
    const cycleElapsed = this.loopEnabled ? elapsed % this.playbackDuration : Math.min(elapsed, this.playbackDuration)
    return this.loopStartTick + cycleElapsed / this.secondsPerTick()
  }

  /** Move o playhead e termina a reprodução única ao alcançar o marcador final. */
  animatePlayhead() {
    if (!this.isPlaying) return
    const now = Tone.now()
    if (!this.loopEnabled && now >= this.playbackStartedAt + this.playbackDuration) {
      this.stop()
      return
    }
    this.currentTick = this.playheadTickAt(now)
    this.playheadTarget.style.left = `${this.musicToPixels(this.currentTick)}px`
    this.playbackFrame = requestAnimationFrame(() => this.animatePlayhead())
  }

  /** Converte o ponto de ponteiro para coordenadas relativas ao Canvas. */
  pointerPoint(event) {
    const rect = this.rollTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  /** Retorna a nota visualmente atingida pelo ponteiro. */
  noteAt(point) {
    return [...this.notes].reverse().find((note) => {
      const x = this.musicToPixels(note.onset)
      const width = this.musicToPixels(note.duration)
      return point.x >= x && point.x <= x + width && point.y >= this.pitchToPixels(note.pitch) && point.y <= this.pitchToPixels(note.pitch) + this.rowHeight
    })
  }

  /** Identifica a borda mais próxima para escolher resize esquerdo ou direito. */
  noteEdge(point, note) {
    const start = this.musicToPixels(note.onset)
    const end = this.musicToPixels(note.onset + note.duration)
    const leftDistance = Math.abs(point.x - start)
    const rightDistance = Math.abs(point.x - end)
    if (leftDistance <= 14 && leftDistance <= rightDistance) return "resize-left"
    if (rightDistance <= 14) return "resize-right"
    return null
  }

  /** Encontra notas cuja área visual cruza o retângulo de seleção. */
  notesInMarquee(start, end) {
    const left = Math.min(start.x, end.x)
    const right = Math.max(start.x, end.x)
    const top = Math.min(start.y, end.y)
    const bottom = Math.max(start.y, end.y)
    return this.notes.filter((note) => {
      const noteLeft = this.musicToPixels(note.onset)
      const noteRight = this.musicToPixels(note.onset + note.duration)
      const noteTop = this.pitchToPixels(note.pitch)
      return noteLeft <= right && noteRight >= left && noteTop <= bottom && noteTop + this.rowHeight >= top
    }).map((note) => note.id)
  }

  /** Seleciona exclusivamente uma nota. */
  selectOnly(id) {
    this.selectedNoteIds = new Set([id])
    const note = this.notes.find((item) => item.id === id)
    if (note) this.statusTarget.textContent = `${this.pitchName(note.pitch)}, compasso ${Math.floor(note.onset / this.measureTicks()) + 1}`
  }

  /** Alterna uma nota na seleção múltipla. */
  toggleSelection(id) {
    if (this.selectedNoteIds.has(id)) this.selectedNoteIds.delete(id)
    else this.selectedNoteIds.add(id)
  }

  /** Salva uma cópia independente das notas selecionadas para um gesto. */
  snapshotSelection() {
    return Object.fromEntries([...this.selectedNoteIds].map((id) => {
      const note = this.notes.find((item) => item.id === id)
      return [id, note && { ...note }]
    }))
  }

  /** Informa a posição musical do cursor para quem navega sem ponteiro. */
  keyboardCursorStatus() {
    const beatTicks = this.ticksPerQuarter * 4 / this.denominator()
    const measure = Math.floor(this.keyboardCursor.onset / this.measureTicks()) + 1
    const beat = Math.floor((this.keyboardCursor.onset % this.measureTicks()) / beatTicks) + 1
    return `Cursor em ${this.pitchName(this.keyboardCursor.pitch)}, compasso ${measure}, tempo ${beat}. Setas movem; Enter cria ou seleciona.`
  }

  /** Move o cursor da grade e mantém sua célula dentro da área visível. */
  revealKeyboardCursor() {
    if (!this.rollViewportTarget) return
    const viewport = this.rollViewportTarget
    const x = this.musicToPixels(this.keyboardCursor.onset)
    const y = this.pitchToPixels(this.keyboardCursor.pitch)
    if (x < viewport.scrollLeft) viewport.scrollLeft = x
    else if (x + this.musicToPixels(this.gridTicks()) > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = x + this.musicToPixels(this.gridTicks()) - viewport.clientWidth
    if (y < viewport.scrollTop) viewport.scrollTop = y
    else if (y + this.rowHeight > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = y + this.rowHeight - viewport.clientHeight
    this.syncViewport()
  }

  /** Permite criar e selecionar notas pelo teclado, além dos atalhos existentes. */
  handleKeyDown(event) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault()
      const step = this.gridTicks()
      if (event.key === "ArrowLeft") this.keyboardCursor.onset = Math.max(0, this.keyboardCursor.onset - step)
      if (event.key === "ArrowRight") this.keyboardCursor.onset = Math.max(0, Math.min(this.totalTicks - Math.min(step, this.totalTicks), this.keyboardCursor.onset + step))
      if (event.key === "ArrowUp") this.keyboardCursor.pitch = this.adjacentPitch(this.keyboardCursor.pitch, -1)
      if (event.key === "ArrowDown") this.keyboardCursor.pitch = this.adjacentPitch(this.keyboardCursor.pitch, 1)
      this.statusTarget.textContent = this.keyboardCursorStatus()
      this.revealKeyboardCursor()
      this.render()
    } else if (event.key === "Enter") {
      event.preventDefault()
      const existing = this.notes.find((note) => note.pitch === this.keyboardCursor.pitch && note.onset === this.keyboardCursor.onset)
      if (existing) this.selectOnly(existing.id)
      else {
        const previous = this.snapshotNotes()
        const note = { id: this.nextNoteIdForEditor(), pitch: this.keyboardCursor.pitch, onset: this.keyboardCursor.onset, duration: Math.min(this.gridTicks(), this.totalTicks - this.keyboardCursor.onset), velocity: 100 }
        this.notes.push(note)
        this.selectOnly(note.id)
        this.commitScore()
        this.confirmNotesChanged(previous)
      }
      this.render()
      this.updateSummary()
    } else if (["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault()
      const previous = this.snapshotNotes()
      this.notes = this.notes.filter((note) => !this.selectedNoteIds.has(note.id))
      this.selectedNoteIds.clear()
      this.commitScore()
      this.confirmNotesChanged(previous)
      this.render()
      this.updateSummary()
    } else if (event.key === "Escape") {
      this.selectedNoteIds.clear()
      this.render()
    } else if (event.key === "+" || event.key === "=") this.zoomIn()
    else if (event.key === "-") this.zoomOut()
  }

  /**
   * Alterna reprodução pelo Espaço; um segundo toque em até 300 ms para e
   * reposiciona a agulha, sem alterar os marcadores nem capturar controles.
   * @param {KeyboardEvent} event Evento do teclado com instante monotônico.
   */
  async handleTransportKeyDown(event) {
    if (!this.audioAvailable()) return
    if ((event.code !== "Space" && event.key !== " ") || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if (!this.element.contains(event.target)) return
    if (event.target?.closest?.("a, button, input, select, textarea, [contenteditable], [role='button']")) return
    event.preventDefault()
    const doubleSpace = this.lastSpaceAt !== null && event.timeStamp - this.lastSpaceAt <= 300 && event.timeStamp >= this.lastSpaceAt
    this.lastSpaceAt = doubleSpace ? null : event.timeStamp
    if (doubleSpace) this.stop()
    else if (this.isPlaying || this.playbackPending) this.stop({ preservePlayhead: true })
    else await this.play()
  }

  /** Alterna a repetição; uma alteração durante a reprodução reinicia o intervalo. */
  toggleLoop() {
    const resume = this.isPlaying
    if (resume) this.stop()
    this.loopEnabled = !this.loopEnabled
    this.loopButtonTarget.classList.toggle("is-active", this.loopEnabled)
    this.loopButtonTarget.setAttribute("aria-pressed", String(this.loopEnabled))
    if (resume) this.play()
  }

  /**
   * Ajusta um limite do loop na grade sem permitir que os marcadores se cruzem.
   * @param {"start"|"end"} marker Marcador que está sendo editado.
   * @param {number} tick Posição musical desejada, antes de snap e limites.
   */
  setLoopBoundary(marker, tick) {
    const snapped = this.snapTick(tick)
    if (marker === "start") this.loopStartTick = Math.max(0, Math.min(this.loopEndTick - this.gridTicks(), snapped))
    else if (marker === "end") this.loopEndTick = Math.min(this.totalTicks, Math.max(this.loopStartTick + this.gridTicks(), snapped))
    this.currentTick = this.loopStartTick
    this.render()
  }

  /** Começa a mover uma das alças na régua, pausando temporariamente o áudio. */
  beginLoopMarkerDrag(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const marker = event.currentTarget.dataset.loopMarker
    const resume = this.isPlaying
    if (resume) this.stop()
    this.loopDrag = { marker, pointerId: event.pointerId, resume }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
  }

  /** Projeta a posição do ponteiro na régua, incluindo seu deslocamento horizontal. */
  moveLoopMarkerDrag(event) {
    if (!this.loopDrag || this.loopDrag.pointerId !== event.pointerId) return
    const x = event.clientX - this.rulerTarget.getBoundingClientRect().left
    this.setLoopBoundary(this.loopDrag.marker, this.pixelsToMusic(x))
  }

  /** Encerra o arraste e retoma a reprodução do novo intervalo quando necessário. */
  endLoopMarkerDrag(event) {
    if (!this.loopDrag || this.loopDrag.pointerId !== event.pointerId) return
    const { resume } = this.loopDrag
    this.loopDrag = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (resume) this.play()
  }

  /** Permite mover os marcadores também com as setas quando recebem foco. */
  handleLoopMarkerKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return
    event.preventDefault()
    const resume = this.isPlaying
    if (resume) this.stop()
    const marker = event.currentTarget.dataset.loopMarker
    const tick = marker === "start" ? this.loopStartTick : this.loopEndTick
    this.setLoopBoundary(marker, tick + (event.key === "ArrowRight" ? this.gridTicks() : -this.gridTicks()))
    if (resume) this.play()
  }

  /** Alterna o encaixe das notas à resolução escolhida. */
  toggleSnap() {
    this.snapEnabled = !this.snapEnabled
    this.snapButtonTarget.classList.toggle("is-active", this.snapEnabled)
    this.snapButtonTarget.setAttribute("aria-pressed", String(this.snapEnabled))
  }

  /** Altera a resolução musical usada por novos gestos. */
  changeGrid(event) {
    this.gridQuarter = Number(event.currentTarget.value)
    this.render()
  }

  /** Aplica uma duração musical explícita às notas selecionadas, respeitando o fim da grade. */
  changeDuration(event) {
    const quarters = Number(event.currentTarget.value)
    if (![0.25, 0.5, 1, 2, 4].includes(quarters) || !this.selectedNoteIds.size) return
    const ticks = Math.round(quarters * this.ticksPerQuarter)
    const previous = this.snapshotNotes()
    this.notes.forEach((note) => {
      if (this.selectedNoteIds.has(note.id)) note.duration = Math.min(ticks, this.totalTicks - note.onset)
    })
    this.commitScore()
    this.confirmNotesChanged(previous)
    this.render()
    this.updateSummary()
  }

  /** Aplica intensidade MIDI inteira (1–127) à seleção, sem afetar outras notas. */
  changeVelocity(event) {
    const velocity = Number(event.currentTarget.value)
    if (!Number.isInteger(velocity) || velocity < 1 || velocity > 127 || !this.selectedNoteIds.size) return
    const previous = this.snapshotNotes()
    this.notes.forEach((note) => {
      if (this.selectedNoteIds.has(note.id)) note.velocity = velocity
    })
    this.commitScore()
    this.confirmNotesChanged(previous)
    this.render()
    this.updateSummary()
  }

  /** Aumenta o zoom horizontal, preservando a representação em ticks. */
  zoomIn() { this.setZoom(Math.min(2, this.pixelsPerQuarter / 88 + 0.25)) }

  /** Diminui o zoom horizontal sem deixar a grade ilegível. */
  zoomOut() { this.setZoom(Math.max(0.5, this.pixelsPerQuarter / 88 - 0.25)) }

  /** Aplica o zoom e redimensiona os Canvas. */
  setZoom(value) {
    this.pixelsPerQuarter = Math.round(value * 88)
    this.zoomLabelTarget.textContent = `${Math.round(value * 100)}%`
    this.resizeCanvases()
  }

  /** Mantém teclado, régua e velocity alinhados às duas posições da grade. */
  syncViewport() {
    const { scrollLeft, scrollTop } = this.rollViewportTarget
    this.keyList.style.transform = `translateY(-${scrollTop}px)`
    this.rulerTarget.style.transform = `translateX(-${scrollLeft}px)`
    this.velocityTarget.style.transform = `translateX(-${scrollLeft}px)`
    this.syncLoopMarkers()
  }

  /** Alinha alças da régua e linhas verticais ao intervalo musical após zoom ou rolagem. */
  syncLoopMarkers() {
    const startPixels = this.musicToPixels(this.loopStartTick)
    const endPixels = this.musicToPixels(this.loopEndTick)
    const scrollLeft = this.rollViewportTarget.scrollLeft
    this.loopStartMarkerTarget.style.left = `${startPixels - scrollLeft}px`
    this.loopEndMarkerTarget.style.left = `${endPixels - scrollLeft}px`
    this.loopStartLineTarget.style.left = `${startPixels}px`
    this.loopEndLineTarget.style.left = `${endPixels}px`
    const beatTicks = this.ticksPerQuarter * 4 / this.denominator()
    const label = (tick) => tick === this.totalTicks ? `fim da região, compasso ${Math.ceil(this.totalTicks / this.measureTicks())}` :
      `compasso ${Math.floor(tick / this.measureTicks()) + 1}, tempo ${(Math.floor((tick % this.measureTicks()) / beatTicks) + 1).toLocaleString("pt-BR")}`
    this.loopStartMarkerTarget.setAttribute("aria-label", `Início do loop: ${label(this.loopStartTick)}. Use as setas para ajustar.`)
    this.loopEndMarkerTarget.setAttribute("aria-label", `Fim do loop: ${label(this.loopEndTick)}. Use as setas para ajustar.`)
  }

  /** Encaminha o wheel das áreas fixas à grade e oferece Shift+wheel horizontal. */
  handleWheel(event) {
    const viewport = this.rollViewportTarget
    let deltaX = 0
    let deltaY = 0

    if (event.currentTarget === this.keyboardTarget) deltaY = event.deltaY
    else if (event.currentTarget !== viewport || event.shiftKey) deltaX = event.deltaX || event.deltaY
    else return

    const nextLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + deltaX))
    const nextTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + deltaY))
    if (nextLeft === viewport.scrollLeft && nextTop === viewport.scrollTop) return

    event.preventDefault()
    viewport.scrollLeft = nextLeft
    viewport.scrollTop = nextTop
    this.syncViewport()
  }

  /** Reproduz uma nota do teclado virtual para confirmar a altura escolhida. */
  async previewPitch(pitch) {
    if (!this.audioAvailable()) {
      this.statusTarget.textContent = "O áudio desta frase está indisponível."
      return
    }
    const generation = this.playbackGeneration
    try {
      await Tone.start()
      if (generation !== this.playbackGeneration) return
      await this.loadInstrument()
      if (generation !== this.playbackGeneration) return
      this.instrument.trigger(pitch, 0.25, Tone.now())
    } catch {
      this.statusTarget.textContent = "O áudio está indisponível neste navegador."
    }
  }

  /** Atualiza o Score e o resumo textual depois de uma edição confirmada. */
  commitScore() {
    this.score = this.buildScore()
    this.statusTarget.textContent = this.selectedNoteIds.size ? `${this.selectedNoteIds.size} nota${this.selectedNoteIds.size === 1 ? " selecionada" : "s selecionadas"}` : "Nenhuma nota selecionada"
    this.dispatch("notes-changed", { detail: { notes: this.snapshotNotes() } })
  }

  /** Mantém o resumo acessível sincronizado com o estado temporário. */
  updateSummary() {
    this.scoreTarget.textContent = `Score inicial: 1 parte, ${Math.ceil(this.totalTicks / this.measureTicks())} compassos, ${this.notes.length} nota${this.notes.length === 1 ? "" : "s"}`
    const selected = this.notes.filter((note) => this.selectedNoteIds.has(note.id))
    // A seleção é um evento de leitura para a orientação; não altera nem salva notas.
    this.dispatch("selection-changed", { detail: { notes: selected.map((note) => ({
      id: note.id, name: this.pitchName(note.pitch), pitch: note.pitch,
      onset: note.onset, duration: note.duration, velocity: note.velocity
    })) } })
    this.durationTarget.disabled = !selected.length
    const durations = new Set(selected.map((note) => note.duration))
    const quarters = selected.length && durations.size === 1 ? selected[0].duration / this.ticksPerQuarter : null
    this.durationTarget.value = [0.25, 0.5, 1, 2, 4].includes(quarters) ? String(quarters) : "custom"
    if (this.hasVelocityInputTarget) {
      this.velocityInputTarget.disabled = !selected.length
      const velocities = new Set(selected.map((note) => note.velocity))
      this.velocityInputTarget.value = selected.length && velocities.size === 1 ? String(selected[0].velocity) : ""
    }
  }

  /** Retorna a distância em ticks do snap atual. */
  gridTicks() { return Math.max(1, Math.round(this.gridQuarter * this.ticksPerQuarter)) }

  /** Arredonda uma posição musical para a grade quando o snap está ligado. */
  snapTick(tick) { return this.snapEnabled ? Math.round(tick / this.gridTicks()) * this.gridTicks() : Math.round(tick) }

  /** Converte ticks em pixels na viewport horizontal. */
  musicToPixels(tick) { return (tick / this.ticksPerQuarter) * this.pixelsPerQuarter }

  /** Converte pixels em ticks sem perder precisão musical. */
  pixelsToMusic(pixels) { return (pixels / this.pixelsPerQuarter) * this.ticksPerQuarter }

  /** Converte MIDI em uma linha visual, com agudos acima dos graves. */
  pitchToPixels(pitch) { return this.displayPitches().indexOf(pitch) * this.rowHeight }

  /** Converte linha visual em pitch MIDI e limita ao teclado apresentado. */
  pixelsToPitch(pixels) {
    const pitches = this.displayPitches()
    return pitches[Math.max(0, Math.min(pitches.length - 1, Math.floor(pixels / this.rowHeight)))]
  }

  /** Percorre as linhas visíveis, respeitando o salto entre peças do kit. */
  adjacentPitch(pitch, rowDelta) {
    const pitches = this.displayPitches()
    return pitches[Math.max(0, Math.min(pitches.length - 1, pitches.indexOf(pitch) + rowDelta))]
  }

  /** Identifica teclas pretas para compor o teclado visual. */
  isBlackKey(pitch) { return [1, 3, 6, 8, 10].includes(pitch % 12) }

  /** Formata uma altura MIDI para o nome musical exibido na interface. */
  pitchName(pitch) {
    if (this.isDrumLayout()) return ({ 42: "Chimbal", 38: "Caixa", 36: "Bumbo" })[pitch] || "Peça desconhecida"
    return `${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`
  }

  /** Libera Canvas, listeners, transporte e instrumento ao sair da página. */
  disconnect() {
    this.closeExpanded({ restoreFocus: false, resize: false })
    this.themeObserver?.disconnect()
    this.rollTarget.removeEventListener("pointerdown", this.onPointerDown)
    this.rollTarget.removeEventListener("pointermove", this.onPointerMove)
    window.removeEventListener("pointerup", this.onPointerUp)
    this.rollTarget.removeEventListener("pointercancel", this.onPointerCancel)
    this.rollTarget.removeEventListener("contextmenu", this.onNoteContextMenu)
    window.removeEventListener("resize", this.onResize)
    this.rollViewportTarget.removeEventListener("scroll", this.onScroll)
    this.keyboardTarget.removeEventListener("wheel", this.onWheel)
    this.rulerTarget.removeEventListener("wheel", this.onWheel)
    this.velocityTarget.removeEventListener("wheel", this.onWheel)
    this.rollViewportTarget.removeEventListener("wheel", this.onWheel)
    this.rollTarget.removeEventListener("keydown", this.onKeyDown)
    this.rollTarget.removeEventListener("focus", this.onRollFocus)
    this.rollTarget.removeEventListener("blur", this.onRollBlur)
    window.removeEventListener("keydown", this.onTransportKeyDown)
    if (this.hasExpandButtonTarget) window.removeEventListener("keydown", this.onExpandedKeyDown, true)
    this.stop()
  }
}
