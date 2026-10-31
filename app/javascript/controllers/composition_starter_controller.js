import { Controller } from "@hotwired/stimulus"
import { createHarmonyPlayback } from "audio/opendaw_harmony"

/**
 * Coordena as propostas transitórias da criação; apenas o formulário definitivo grava notas.
 * Tônica e modo regeneram acordes; BPM e timbre alteram somente a reprodução.
 */
export default class extends Controller {
  static values = { previewUrl: String }
  static targets = ["bpm", "tonic", "mode", "instrument", "degrees", "status", "previews"]

  /** Inicia o áudio e pede propostas para as configurações visíveis. */
  connect() {
    this.revision = 0
    this.previews = []
    this.selectedIndex = null
    this.playback = createHarmonyPlayback()
    void this.refreshContext()
  }

  /** Libera o motor de áudio ao navegar para outra página. */
  disconnect() {
    this.revision += 1
    this.playback?.dispose()
  }

  /** Substitui propostas depois de uma mudança tonal, descartando respostas antigas. */
  async refreshContext() {
    const revision = ++this.revision
    this.playback?.stop()
    this.degreesTarget.value = ""
    this.selectedIndex = null
    this.previews = []
    this.renderPreviews()
    this.statusTarget.textContent = "Gerando novas propostas…"
    try {
      const response = await fetch(this.previewUrlValue, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify({ composition: { bpm: this.bpmTarget.value, tonic: this.tonicTarget.value,
          mode: this.modeTarget.value, instrument: this.instrumentTarget.value } })
      })
      const result = await response.json()
      if (revision !== this.revision) return
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar propostas")
      this.previews = result.previews
      this.renderPreviews()
      this.statusTarget.textContent = "Ouça e escolha uma proposta, ou comece sem acordes."
    } catch (error) {
      if (revision === this.revision) this.statusTarget.textContent = `Prévia indisponível: ${error.message}. Você ainda pode criar a composição.`
    }
  }

  /** Muda a próxima escuta sem alterar as propostas nem a escolha do usuário. */
  updateSound() {
    this.playback?.stop()
    this.statusTarget.textContent = "A próxima escuta usará o novo andamento e instrumento."
  }

  /** Marca os graus que deverão ser reconstruídos pelo servidor no envio do formulário. */
  selectPreview(event) {
    const index = Number(event.currentTarget.dataset.index)
    const sequence = this.previews[index]
    if (!sequence) return
    this.selectedIndex = index
    this.degreesTarget.value = sequence.map(option => option.index).join(",")
    this.renderPreviews()
    this.statusTarget.textContent = `Proposta ${index + 1} escolhida para iniciar a composição.`
  }

  /** Ouve a proposta sem alterar o campo enviado pelo formulário. */
  async playPreview(event) {
    const sequence = this.previews[Number(event.currentTarget.dataset.index)]
    if (!sequence) return
    try {
      this.statusTarget.textContent = "Preparando áudio…"
      await this.playback.preview(this.previewDocument(sequence))
      this.statusTarget.textContent = "Reproduzindo proposta."
    } catch (error) {
      this.statusTarget.textContent = `Áudio indisponível: ${error.message}. Você ainda pode escolher pelos acordes.`
    }
  }

  /** Interrompe a prévia corrente sem afetar a seleção. */
  stopPreview() {
    this.playback?.stop()
    this.statusTarget.textContent = "Áudio parado."
  }

  /** Monta um documento temporário compatível com o transporte da harmonia. */
  previewDocument(sequence) {
    const notes = sequence.flatMap((option, beat) => option.pitches.map((pitch, voice) => ({
      id: `preview-${beat}-${voice}`, pitch, onset_tick: beat * 480, duration_ticks: 480, velocity: 90
    })))
    return { version: 1, id: "starter-preview", name: "Prévia", bpm: Number(this.bpmTarget.value),
      time_signature: { numerator: 4, denominator: 4 },
      context: { tonic: this.tonicTarget.value, mode: this.modeTarget.value },
      tracks: [{ id: "harmony-starter-preview", name: "Harmonia", instrument_id: this.instrumentTarget.value,
        volume: 0.7, mute: false, solo: false,
        regions: [{ id: "starter-region", start_tick: 0, duration_ticks: 1920, notes }] }] }
  }

  /** Apresenta cada proposta com ações separadas de escuta e escolha. */
  renderPreviews() {
    const container = this.previewsTarget
    container.replaceChildren()
    this.previews.forEach((sequence, index) => {
      const row = document.createElement("div")
      row.className = "music-starter-preview"
      const description = document.createElement("div")
      const title = document.createElement("strong")
      title.textContent = `Ideia ${index + 1}`
      const chords = document.createElement("span")
      chords.textContent = sequence.map(option => option.symbol).join("  ·  ")
      description.append(title, chords)
      const actions = document.createElement("div")
      const play = document.createElement("button")
      play.type = "button"
      play.className = "product-button product-button-secondary"
      play.textContent = "Ouvir"
      play.dataset.index = String(index)
      play.dataset.action = "click->composition-starter#playPreview"
      const choose = document.createElement("button")
      choose.type = "button"
      choose.className = "product-button product-button-secondary"
      choose.textContent = this.selectedIndex === index ? "Escolhida" : "Começar com esta"
      choose.setAttribute("aria-pressed", String(this.selectedIndex === index))
      choose.dataset.index = String(index)
      choose.dataset.action = "click->composition-starter#selectPreview"
      actions.append(play, choose)
      row.append(description, actions)
      container.append(row)
    })
  }
}
