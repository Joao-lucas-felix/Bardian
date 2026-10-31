import * as Tone from "tone"

const STRINGS = { G2: "G2.mp3", D3: "D3.mp3", C4: "C4.mp3", G4: "G4.mp3", D5: "D5.mp3" }
const DRUMS = { 36: "/audio/drums/kick.mp3", 38: "/audio/drums/snare.mp3", 42: "/audio/drums/hat.mp3" }

/**
 * Catálogo estável usado pela timeline e pelo motor de reprodução.
 * Samples locais são preferidos quando existem; as demais famílias usam
 * síntese procedural para ampliar a escolha sem adicionar assets externos.
 */
export const INSTRUMENT_CATALOG = Object.freeze({
  piano: Object.freeze({ label: "Piano", category: "pianos", source: "sample-salamander", kind: "sample" }),
  keyboard: Object.freeze({ label: "Teclado elétrico", category: "teclados", source: "synth-procedural", kind: "synth", synth: { oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.55, release: 0.8 }, volume: -10 } }),
  strings: Object.freeze({ label: "Cordas", category: "cordas", source: "sample-strings", kind: "sample" }),
  guitar: Object.freeze({ label: "Guitarra limpa", category: "cordas dedilhadas", source: "synth-procedural", kind: "synth", synth: { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.45 }, volume: -8 } }),
  bass: Object.freeze({ label: "Baixo elétrico", category: "baixo", source: "synth-procedural", kind: "synth", synth: { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.7, release: 0.35 }, volume: -7 } }),
  winds: Object.freeze({ label: "Sopro", category: "sopros", source: "synth-procedural", kind: "synth", synth: { oscillator: { type: "square" }, envelope: { attack: 0.08, decay: 0.18, sustain: 0.65, release: 0.25 }, volume: -18 } }),
  synth: Object.freeze({ label: "Pad sintetizado", category: "sintetizadores e pads", source: "synth-procedural", kind: "synth", synth: { oscillator: { type: "sawtooth" }, envelope: { attack: 0.25, decay: 0.4, sustain: 0.7, release: 1.2 }, volume: -18 } }),
  drums: Object.freeze({ label: "Bateria", category: "bateria e percussão", source: "samples-drums", kind: "sample" })
})

/** Traduz a altura MIDI para a notação científica esperada pelo Tone.Sampler. */
function noteName(pitch) {
  return `${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`
}

/**
 * Cria uma fonte sonora descartável para a frase ativa, sem modificar MIDI.
 * @param {keyof INSTRUMENT_CATALOG} instrumentId Identificador do catálogo.
 * @param {{destination?: object}} options Saída opcional para mixar a faixa.
 * @returns {{load: () => Promise<void>, trigger: (pitch: number, durationSeconds: number, time: number, velocity?: number) => boolean, stopVoices: () => void, dispose: () => void}}
 */
export function createPhraseInstrument(instrumentId, { destination } = {}) {
  // Presets exclusivos não podem ser substituídos silenciosamente pelo motor legado.
  if (instrumentId?.startsWith("harmony_")) throw new Error("Este timbre usa openDAW. Abra a página de harmonia para ouvir.")
  const definition = INSTRUMENT_CATALOG[instrumentId]
  if (!definition) throw new Error("Instrumento desconhecido")
  let nodes = []
  let ready = false
  let disposed = false
  let pending = null
  const activeVoices = new Set()

  /** Mantém a saída antiga quando não há um canal de faixa específico. */
  function route(node) { return destination ? node.connect(destination) : node.toDestination() }

  /** Libera tentativa incompleta antes de recomeçar após falha. */
  function clearNodes() {
    const voices = [...activeVoices]
    activeVoices.clear()
    voices.forEach((voice) => voice.dispose())
    nodes.forEach((node) => node.dispose())
    nodes = []
    ready = false
  }

  return {
    /** Carrega amostras locais sob demanda; uma falha permite nova tentativa. */
    load() {
      if (disposed) return Promise.reject(new Error("Instrumento encerrado"))
      if (ready) return Promise.resolve()
      if (pending) return pending
      if (definition.kind === "synth") {
        const synth = route(new Tone.PolySynth(Tone.Synth, definition.synth))
        nodes = [synth]
        pending = Promise.resolve().then(() => {
          if (!disposed) ready = true
        }).catch((error) => {
          clearNodes()
          pending = null
          throw error
        })
      } else if (instrumentId === "drums") {
        const entries = Object.entries(DRUMS)
        const players = entries.map(() => route(new Tone.Player()))
        nodes = players
        pending = Promise.all(players.map((player, index) => player.load(entries[index][1]))).then(() => {
          if (!disposed) ready = true
        }).catch((error) => {
          clearNodes()
          pending = null
          throw error
        })
      } else {
        const urls = instrumentId === "piano" ? { A4: "A4.mp3" } : STRINGS
        const baseUrl = instrumentId === "piano" ? "/audio/salamander/" : "/audio/strings/"
        pending = new Promise((resolve, reject) => {
          // Cordas já vêm niveladas para notas curtas; piano mantém sua atenuação original.
          const volume = instrumentId === "strings" ? -6 : -12
          const sampler = route(new Tone.Sampler({ urls, baseUrl, release: .35, volume, onload: resolve, onerror: reject }))
          nodes = [sampler]
        }).then(() => {
          if (!disposed) ready = true
        }).catch((error) => {
          clearNodes()
          pending = null
          throw error
        })
      }
      return pending
    },

    /** Agenda um evento válido; bateria ignora alturas fora do kit. */
    trigger(pitch, durationSeconds, time, velocity = 1) {
      if (disposed || !ready) return false
      if (definition.kind === "synth") nodes[0].triggerAttackRelease(noteName(pitch), durationSeconds, time, velocity)
      else if (instrumentId === "drums") {
        const index = Object.keys(DRUMS).indexOf(String(pitch))
        if (index < 0) return false
        // Cada ataque recebe sua própria fonte; batidas rápidas não cortam a cauda anterior.
        let voice
        voice = route(new Tone.Player({ url: nodes[index].buffer, onstop: () => {
          if (activeVoices.delete(voice)) voice.dispose()
        } }))
        voice.volume.value = velocity > 0 ? 20 * Math.log10(velocity) : -Infinity
        activeVoices.add(voice)
        voice.start(time)
      } else if (velocity === 1) nodes[0].triggerAttackRelease(noteName(pitch), durationSeconds, time)
      else nodes[0].triggerAttackRelease(noteName(pitch), durationSeconds, time, velocity)
      return true
    },

    /** Interrompe caudas ao pausar, sem descartar os samples carregados. */
    stopVoices() {
      if (definition.kind === "synth") nodes[0].releaseAll()
      else if (instrumentId === "drums") {
        for (const voice of [...activeVoices]) voice.stop()
      } else if (ready) nodes[0].releaseAll()
    },

    /** Interrompe e libera os recursos desta frase. */
    dispose() {
      disposed = true
      clearNodes()
    }
  }
}
