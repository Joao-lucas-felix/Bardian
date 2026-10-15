import { Controller } from "@hotwired/stimulus"
import { drawPhraseWaveform } from "creation/phrase_waveform"

/**
 * Organiza o Trecho 1 em frases independentes guardadas apenas na página.
 * Recebe snapshots MIDI do piano roll e desenha uma prévia derivada deles.
 */
export default class extends Controller {
  static targets = ["card", "template", "timeline"]

  /** Inicia as quatro frases vazias; uma nova visita começa sem notas. */
  connect() {
    this.phrases = new Map()
    this.instruments = new Map()
    this.activeKey = null
    this.activeEditor = null
    this.onResize = () => this.cardTargets.forEach((card) => this.renderPreview(card.dataset.phraseKey))
    window.addEventListener("resize", this.onResize)
    this.cardTargets.forEach((card) => this.renderPreview(card.dataset.phraseKey))
  }

  /** Desliga o editor ativo quando a página é removida. */
  disconnect() {
    window.removeEventListener("resize", this.onResize)
    this.closeActive()
  }

  /** Mantém régua e quatro faixas na mesma posição ao rolar no celular. */
  syncTimeline(event) {
    this.timelineTargets.forEach((item) => {
      if (item !== event.currentTarget) item.scrollLeft = event.currentTarget.scrollLeft
    })
  }

  /** Abre uma frase e recolhe a anterior, ou fecha a frase já aberta. */
  toggle(event) {
    const key = event.currentTarget.dataset.creationKeyParam
    const card = this.cardTargets.find((item) => item.dataset.phraseKey === key)
    if (!card) return
    if (this.activeKey === key) {
      this.closeActive()
      return
    }
    this.closeActive()
    const editor = this.templateTarget.content.firstElementChild.cloneNode(true)
    const audioEnabled = card.dataset.audioEnabled === "true"
    editor.dataset.pianoRollInitialNotesValue = JSON.stringify(this.phrases.get(key) || [])
    editor.dataset.pianoRollAudioEnabledValue = String(audioEnabled)
    editor.dataset.pianoRollLayoutValue = key.startsWith("drums:") ? "drums" : "pitched"
    editor.dataset.pianoRollInstrumentIdValue = key.startsWith("drums:") ? "drums" : (this.instruments.get(key) || "piano")
    editor.dataset.pianoRollPartNameValue = card.dataset.partName
    editor.querySelector(".piano-roll-card-header h2").textContent = `Piano roll · ${card.dataset.partName}`
    if (key.startsWith("drums:")) {
      editor.querySelector(".piano-roll-subtitle").textContent = "Crie o ritmo nas linhas de chimbal, caixa e bumbo. Toque para ouvir cada peça."
      editor.querySelector(".piano-roll-help").textContent = "Clique ou arraste para criar batidas; clique direito exclui. Ajuste posição e duração na grade."
    }
    const panel = card.querySelector(".midi-phrase-panel")
    panel.hidden = false
    panel.replaceChildren(editor)
    const button = card.querySelector(".midi-phrase-toggle")
    button.setAttribute("aria-expanded", "true")
    button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^Abrir/, "Fechar"))
    this.activeKey = key
    this.activeEditor = editor
  }

  /** Guarda o timbre desta frase e remonta somente o editor ativo, mantendo MIDI. */
  changeInstrument(event) {
    const { value, dataset } = event.currentTarget
    const key = dataset.creationKeyParam
    if (!key || key.startsWith("drums:") || !["piano", "strings"].includes(value)) return
    this.instruments.set(key, value)
    if (this.activeKey !== key) return
    const card = this.cardTargets.find((item) => item.dataset.phraseKey === key)
    this.closeActive()
    this.toggle({ currentTarget: card.querySelector(".midi-phrase-toggle") })
  }

  /** Interrompe imediatamente o áudio e remove a instância anterior. */
  closeActive() {
    if (!this.activeKey) return
    const card = this.cardTargets.find((item) => item.dataset.phraseKey === this.activeKey)
    const controller = this.application.getControllerForElementAndIdentifier(this.activeEditor, "piano-roll")
    controller?.stop()
    const panel = card.querySelector(".midi-phrase-panel")
    panel.replaceChildren()
    panel.hidden = true
    const button = card.querySelector(".midi-phrase-toggle")
    button.setAttribute("aria-expanded", "false")
    button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^Fechar/, "Abrir"))
    this.activeKey = null
    this.activeEditor = null
  }

  /** Aceita somente alterações emitidas pelo piano roll atualmente aberto. */
  notesChanged(event) {
    if (!this.activeKey || event.target !== this.activeEditor || !Array.isArray(event.detail?.notes)) return
    this.phrases.set(this.activeKey, event.detail.notes.map(({ id, pitch, onset, duration, velocity }) => ({ id, pitch, onset, duration, velocity })))
    this.renderPreview(this.activeKey)
  }

  /** Redesenha uma forma de onda ilustrativa a partir do estado MIDI da frase. */
  renderPreview(key) {
    const card = this.cardTargets.find((item) => item.dataset.phraseKey === key)
    if (!card) return
    const preview = card.querySelector(".midi-phrase-preview")
    const notes = this.phrases.get(key) || []
    preview.querySelector(".midi-phrase-empty").hidden = notes.length > 0
    const count = preview.querySelector(".midi-phrase-count")
    if (count) count.textContent = notes.length ? `${notes.length} nota${notes.length === 1 ? "" : "s"}` : ""
    preview.setAttribute("aria-label", `Trecho 1, ${card.dataset.partName}: ${notes.length} nota${notes.length === 1 ? "" : "s"}`)
    drawPhraseWaveform(preview.querySelector("canvas"), notes, { totalTicks: 7680, color: globalThis.getComputedStyle?.(card).getPropertyValue("--phrase-wave").trim() || "#b93830" })
  }
}
