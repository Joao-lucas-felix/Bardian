import * as Tone from "tone"
import { createPhraseInstrument } from "audio/phrase_instruments"

/**
 * Cria a borda sonora da composição, sem consultar DOM ou alterar o MIDI.
 * Cada faixa recebe seu próprio ganho e instrumento; callbacks do relógio
 * podem ser cancelados antes do disparo de uma nota.
 * @param {{timers?:object}} options Temporizadores substituíveis para testes.
 * @returns {object} Controles de carregamento, agendamento e ciclo de vida.
 */
export function createCompositionAudio({ timers = globalThis } = {}) {
  const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
  const tracks = new Map()
  const scheduled = new Map()
  let disposed = false

  /** Cancela tanto o aviso antecipado do Tone quanto o disparo ainda pendente. */
  function cancelScheduled(token) {
    const entry = scheduled.get(token)
    if (!entry) return
    scheduled.delete(token)
    transport.clear(token)
    if (entry.timerId !== null) timers.clearTimeout(entry.timerId)
  }

  /** Libera uma faixa e impede que seu carregamento atrasado volte a tocá-la. */
  function disposeTrack(trackId) {
    const entry = tracks.get(trackId)
    if (!entry) return
    tracks.delete(trackId)
    entry.instrument.dispose()
    entry.gain.dispose()
  }

  return {
    /** Ativa Web Audio por gesto do usuário e inicia o relógio compartilhado. */
    async start() {
      if (disposed) throw new Error("Áudio encerrado")
      await Tone.start()
      if (disposed) return
      transport.start()
    },

    /** Suspende e reinicia a posição temporal sem descartar as fontes. */
    pause() { if (!disposed) transport.pause() },
    stop() {
      if (disposed) return
      for (const token of scheduled.keys()) cancelScheduled(token)
      transport.stop()
    },
    now() { return transport.seconds },

    /** Mantém o callback cancelável até o ataque real, mesmo após aviso antecipado. */
    schedule(callback, atSeconds) {
      if (disposed) throw new Error("Áudio encerrado")
      let token
      token = transport.scheduleOnce(() => {
        const entry = scheduled.get(token)
        if (!entry || disposed) return
        // Tone avisa com antecedência; só o temporizador dispara a fonte no instante real.
        const delay = Math.max(0, (atSeconds - transport.seconds) * 1000)
        entry.timerId = timers.setTimeout(() => {
          if (!scheduled.delete(token) || disposed) return
          callback(Tone.now())
        }, delay)
      }, atSeconds)
      scheduled.set(token, { timerId: null })
      return token
    },
    cancel: cancelScheduled,

    /** Carrega um timbre local para a faixa sem prejudicar as demais em caso de falha. */
    async loadTrack(track) {
      if (disposed) throw new Error("Áudio encerrado")
      const current = tracks.get(track.id)
      if (current?.instrumentId === track.instrument_id) {
        current.gain.gain.value = track.volume
        return current.loading
      }
      disposeTrack(track.id)
      const gain = new Tone.Gain(track.volume).toDestination()
      let instrument
      try { instrument = createPhraseInstrument(track.instrument_id, { destination: gain }) }
      catch (error) { gain.dispose(); throw error }
      const entry = { instrumentId: track.instrument_id, instrument, gain, loading: null, ready: false }
      tracks.set(track.id, entry)
      entry.loading = instrument.load().then(() => {
        if (!disposed && tracks.get(track.id) === entry) entry.ready = true
      }).catch((error) => {
        if (tracks.get(track.id) === entry) disposeTrack(track.id)
        throw error
      })
      return entry.loading
    },

    /** Dispara uma nota com sua velocity; false identifica fonte ou pitch indisponível. */
    trigger(trackId, pitch, durationSeconds, time, velocity) {
      const entry = tracks.get(trackId)
      if (disposed || !entry?.ready) return false
      return entry.instrument.trigger(pitch, durationSeconds, time, velocity / 127)
    },

    /** Aplica ganho imediatamente, inclusive às vozes que já estão soando. */
    setTrackVolume(trackId, volume) {
      const entry = tracks.get(trackId)
      if (entry && !disposed) entry.gain.gain.value = volume
    },
    silenceTrack(trackId) {
      const entry = tracks.get(trackId)
      if (entry && !disposed) entry.gain.gain.value = 0
    },
    disposeTrack,

    /** Cancela eventos pendentes e libera todas as fontes ao sair da página. */
    dispose() {
      if (disposed) return
      this.stop()
      for (const trackId of tracks.keys()) disposeTrack(trackId)
      disposed = true
    }
  }
}
