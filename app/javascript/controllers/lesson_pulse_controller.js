import { Controller } from "@hotwired/stimulus"
import * as Tone from "tone"
import { createPhraseInstrument } from "audio/phrase_instruments"

/** Experimento finito de pulsação: agenda áudio e mostra oito tempos, sem alterar composições. */
export default class extends Controller {
  static targets = ["tempo", "silent", "subdivide", "start", "stop", "status", "counter", "beat"]

  /** Prepara controles sem iniciar áudio; sair da aba interrompe a experiência. */
  connect() {
    this.generation = 0
    this.onVisibility = () => { if (document.hidden) this.stop() }
    document.addEventListener("visibilitychange", this.onVisibility)
  }

  /** Agenda oito pulsos; o controle distingue carga, execução audível e prática silenciosa. */
  async start() {
    this.stop()
    const generation = this.generation
    const bpm = Number(this.tempoTarget.value)
    if (![60, 90, 120].includes(bpm)) return
    this.startTarget.disabled = true
    this.startTarget.dataset.audioState = this.silentTarget.checked ? "silent" : "loading"
    this.stopTarget.disabled = false
    this.statusTarget.textContent = "Preparando a experiência…"
    try {
      if (!this.silentTarget.checked) await Tone.start()
      if (generation !== this.generation) return
      this.interval = 60 / bpm
      const divisions = this.subdivideTarget.checked ? 2 : 1
      let lead = .05
      if (!this.silentTarget.checked) {
        // Oito notas curtas de piano marcam a pulsação sem alterar o BPM escolhido.
        this.output = new Tone.Gain(4).toDestination()
        this.voice = createPhraseInstrument("piano", { destination: this.output })
        await this.voice.load()
        if (generation !== this.generation) return
        const start = Tone.now() + .05
        // Compensa a antecedência de agendamento do Tone antes de destacar o primeiro número.
        lead = start - Tone.immediate()
        for (let index = 0; index < 8 * divisions; index++) {
          this.voice.trigger(84, .08, start + index * this.interval / divisions, .5)
        }
      }
      // O relógio visual também funciona sem AudioContext ativo no modo silencioso.
      this.beginsAt = performance.now() / 1000 + lead
      this.endsAt = this.beginsAt + 8 * this.interval
      this.startTarget.dataset.audioState = this.silentTarget.checked ? "silent" : "playing"
      this.statusTarget.textContent = `Experiência iniciada: ${bpm} BPM, oito tempos${divisions === 2 ? ", duas batidas por tempo" : ""}.`
      this.frame = requestAnimationFrame(() => this.paint())
    } catch {
      if (generation !== this.generation) return
      this.stop()
      this.statusTarget.textContent = "Não foi possível iniciar o áudio. Tente novamente ou marque ‘Praticar sem som’."
    }
  }

  /** Atualiza a indicação com o relógio, sem acumular atraso de timers entre os tempos. */
  paint() {
    const now = performance.now() / 1000
    if (now >= this.endsAt) {
      this.stop()
      this.statusTarget.textContent = "Oito tempos concluídos. Compare outro andamento ou repita a experiência."
      return
    }
    if (now >= this.beginsAt) {
      const index = Math.floor((now - this.beginsAt) / this.interval)
      this.counterTarget.textContent = `Tempo ${index % 4 + 1} · volta ${Math.floor(index / 4) + 1} de 2`
      this.beatTargets.forEach((beat, position) => beat.setAttribute("data-active", String(position === index % 4)))
    }
    this.frame = requestAnimationFrame(() => this.paint())
  }

  /** Cancela preparação, quadros e sons futuros; devolve o violão ao Play inicial. */
  stop() {
    this.generation++
    cancelAnimationFrame(this.frame)
    this.voice?.dispose()
    this.voice = null
    this.output?.dispose()
    this.output = null
    this.startTarget.disabled = false
    this.startTarget.dataset.audioState = "idle"
    this.stopTarget.disabled = true
    this.beatTargets.forEach(beat => beat.setAttribute("data-active", "false"))
    this.counterTarget.textContent = "1 · 2 · 3 · 4"
    this.statusTarget.textContent = "Pronto. Escolha o andamento e inicie quando quiser."
  }

  /** Descarta recursos ao navegar, sem interferir no transporte global de outras ferramentas. */
  disconnect() {
    this.stop()
    document.removeEventListener("visibilitychange", this.onVisibility)
  }
}
