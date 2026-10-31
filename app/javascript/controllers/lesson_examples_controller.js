import { Controller } from "@hotwired/stimulus"
import * as Tone from "tone"
import { createPhraseInstrument } from "audio/phrase_instruments"

/** Reproduz exemplos finitos de aulas sem iniciar áudio nem alterar a composição. */
export default class extends Controller {
  static targets = ["play", "stop", "status", "progress"]

  /** Observa a aba para interromper um som que o estudante deixou tocando. */
  connect() {
    this.generation = 0
    this.onVisibility = () => { if (document.hidden) this.stop() }
    document.addEventListener("visibilitychange", this.onVisibility)
  }

  /** Agenda um exemplo editorial e mostra montagem do violão somente durante o preparo real. */
  async play(event) {
    this.stop()
    const generation = this.generation
    const button = event.currentTarget
    const { beats, bpm, instrument, title } = button.dataset
    const total = Number(beats)
    const tempo = Number(bpm)
    let notes
    try { notes = JSON.parse(button.dataset.events) } catch { notes = [] }
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(tempo) || tempo <= 0 || !Array.isArray(notes)) return

    this.playTargets.forEach(play => { play.disabled = true })
    button.dataset.audioState = "loading"
    this.stopTarget.disabled = false
    this.statusTarget.textContent = "Preparando o áudio…"
    try {
      await Tone.start()
      if (generation !== this.generation) return
      if (instrument === "sine") {
        // A exceção senoidal isola a comparação de timbre da aula de escuta.
        this.voice = new Tone.Synth({ oscillator: { type: "sine" },
          envelope: { attack: .005, decay: .06, sustain: .45, release: .08 }, volume: 0 }).toDestination()
      } else {
        // A amostra local recebe ganho só nesta aula; o piano do editor não muda.
        this.output = new Tone.Gain(4).toDestination()
        this.voice = createPhraseInstrument("piano", { destination: this.output })
        await this.voice.load()
        if (generation !== this.generation) return
      }
      const secondsPerBeat = 60 / tempo
      const start = Tone.now() + .05
      // O relógio visual parte do instante real de áudio, incluindo o look-ahead do Tone.
      this.beginsAt = performance.now() / 1000 + start - Tone.immediate()
      this.endsAt = this.beginsAt + total * secondsPerBeat
      for (const note of notes) {
        const at = Number(note.at), duration = Number(note.duration), velocity = Number(note.velocity)
        if (!Number.isFinite(at) || !Number.isFinite(duration) || at < 0 || duration <= 0 || at + duration > total) continue
        if (instrument === "sine") this.voice.triggerAttackRelease(note.pitch, duration * secondsPerBeat, start + at * secondsPerBeat, velocity)
        else this.voice.trigger(Tone.Frequency(note.pitch).toMidi(), duration * secondsPerBeat, start + at * secondsPerBeat, velocity)
      }
      this.activeProgress = this.progressTargets[this.playTargets.indexOf(button)]
      button.dataset.audioState = "playing"
      this.statusTarget.textContent = `Tocando: ${title}. Use Parar para interromper.`
      this.frame = requestAnimationFrame(() => this.paint())
    } catch {
      if (generation !== this.generation) return
      this.stop()
      this.statusTarget.textContent = "O áudio não pôde começar. Leia a descrição do exemplo ou tente novamente."
    }
  }

  /** Mostra a passagem do tempo como apoio visual, sem anunciar cada quadro. */
  paint() {
    const now = performance.now() / 1000
    if (now >= this.endsAt) {
      this.stop()
      this.statusTarget.textContent = "Exemplo concluído. Escolha outro ou repita para comparar."
      return
    }
    if (now >= this.beginsAt && this.activeProgress) {
      this.activeProgress.value = Math.min(100, 100 * (now - this.beginsAt) / (this.endsAt - this.beginsAt))
    }
    this.frame = requestAnimationFrame(() => this.paint())
  }

  /** Cancela sons futuros e preparação pendente; todos os controles voltam ao Play inicial. */
  stop() {
    this.generation++
    cancelAnimationFrame(this.frame)
    this.voice?.dispose()
    this.voice = null
    this.output?.dispose()
    this.output = null
    this.playTargets.forEach(play => { play.disabled = false; play.dataset.audioState = "idle" })
    this.progressTargets.forEach(progress => { progress.value = 0 })
    this.stopTarget.disabled = true
    this.statusTarget.textContent = "Pronto. Escolha um exemplo para ouvir."
  }

  /** Libera instrumento e observador quando a navegação remove a experiência. */
  disconnect() {
    this.stop()
    document.removeEventListener("visibilitychange", this.onVisibility)
  }
}
