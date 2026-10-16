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
 * @param {{destination?: object}} options Saída opcional para mixar a faixa.
 * @returns {{load: () => Promise<void>, trigger: (pitch: number, durationSeconds: number, time: number, velocity?: number) => boolean, stopVoices: () => void, dispose: () => void}}
 */
export function createPhraseInstrument(instrumentId, { destination } = {}) {
  if (!["piano", "strings", "drums"].includes(instrumentId)) throw new Error("Instrumento desconhecido")
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
      if (instrumentId === "drums") {
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
      if (instrumentId === "drums") {
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
      if (instrumentId === "drums") {
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
