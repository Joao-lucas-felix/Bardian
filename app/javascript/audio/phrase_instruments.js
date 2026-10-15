import * as Tone from "tone"

const STRINGS = { G2: "G2.mp3", D3: "D3.mp3", C4: "C4.mp3", G4: "G4.mp3", D5: "D5.mp3" }
const DRUMS = { 36: "/audio/drums/kick.mp3", 38: "/audio/drums/snare.mp3", 42: "/audio/drums/hat.mp3" }

/** Traduz a altura MIDI para a notação científica esperada pelo Tone.Sampler. */
function noteName(pitch) {
  return `${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`
}

/**
 * Cria uma fonte sonora descartável para a frase ativa, sem modificar MIDI.
 * @param {"piano"|"strings"|"drums"} instrumentId Identificador do catálogo.
 * @returns {{load: () => Promise<void>, trigger: (pitch: number, durationSeconds: number, time: number) => void, dispose: () => void}}
 */
export function createPhraseInstrument(instrumentId) {
  if (!["piano", "strings", "drums"].includes(instrumentId)) throw new Error("Instrumento desconhecido")
  let nodes = []
  let ready = false
  let disposed = false
  let pending = null
  const activeVoices = new Set()

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
      if (instrumentId === "drums") {
        const entries = Object.entries(DRUMS)
        const players = entries.map(() => new Tone.Player().toDestination())
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
          const sampler = new Tone.Sampler({ urls, baseUrl, release: .35, volume, onload: resolve, onerror: reject }).toDestination()
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
    trigger(pitch, durationSeconds, time) {
      if (disposed || !ready) return
      if (instrumentId === "drums") {
        const index = Object.keys(DRUMS).indexOf(String(pitch))
        if (index < 0) return
        // Cada ataque recebe sua própria fonte; batidas rápidas não cortam a cauda anterior.
        let voice
        voice = new Tone.Player({ url: nodes[index].buffer, onstop: () => {
          if (activeVoices.delete(voice)) voice.dispose()
        } }).toDestination()
        activeVoices.add(voice)
        voice.start(time)
      } else nodes[0].triggerAttackRelease(noteName(pitch), durationSeconds, time)
    },

    /** Interrompe e libera os recursos desta frase. */
    dispose() {
      disposed = true
      clearNodes()
    }
  }
}
