import { arrangementEndTick, eventsInRange, loopRange, secondsPerTick } from "composition/playback_events"

/**
 * Coordena o relógio, os ciclos e as faixas sem conhecer DOM ou Canvas.
 * O áudio é injetável para provar agendamento e transições sem Web Audio.
 * @param {{audio:object,onState:Function,timer?:object}} options Borda sonora e notificação.
 * @returns {object} Transporte da composição e seu ciclo de vida.
 */
export function createCompositionTransport({ audio, onState, timer = globalThis }) {
  let music = null
  let status = "stopped"
  let positionTick = 0
  let anchorTick = 0
  let anchorSeconds = 0
  let range = { startTick: 0, endTick: 0 }
  let loopEnabled = true
  let isolatedTrackId = null
  let unavailableTrackIds = []
  let availableTrackIds = new Set()
  let generation = 0
  let pulseTimer = null
  let disposed = false
  const pending = new Map()
  const seen = new Set()

  /** Envia um estado independente, sem entregar coleções internas mutáveis. */
  function emit() {
    if (!disposed) onState({ status, tick: positionTick, loopEnabled, unavailableTrackIds: [...unavailableTrackIds] })
  }

  /** Calcula posição musical pelo relógio de áudio, preservando os ticks. */
  function absoluteTickAt(seconds) {
    return anchorTick + Math.max(0, seconds - anchorSeconds) / secondsPerTick(music.bpm)
  }

  /** Converte a posição absoluta do ciclo para a agulha visível. */
  function visibleTickAt(seconds) {
    const absolute = absoluteTickAt(seconds)
    if (!loopEnabled || range.endTick <= range.startTick) return Math.min(absolute, range.endTick)
    const length = range.endTick - range.startTick
    return range.startTick + ((absolute - range.startTick) % length + length) % length
  }

  /** Cancela só ataques futuros; notas já iniciadas pertencem à fonte sonora. */
  function clearPending() {
    for (const entry of pending.values()) audio.cancel(entry.token)
    pending.clear()
  }

  /** Agenda a interseção da janela com um ciclo sem duplicar IDs já vistos. */
  function scheduleSegment(cycle, fromAbsolute, toAbsolute) {
    const length = range.endTick - range.startTick
    const fromTick = fromAbsolute - cycle * length
    const toTick = toAbsolute - cycle * length
    for (const event of eventsInRange(music, fromTick, toTick, isolatedTrackId)) {
      if (!availableTrackIds.has(event.trackId)) continue
      const key = `${cycle}:${event.trackId}:${event.id}`
      if (seen.has(key)) continue
      seen.add(key)
      const atSeconds = anchorSeconds + (cycle * length + event.onsetTick - anchorTick) * secondsPerTick(music.bpm)
      const duration = event.durationTicks * secondsPerTick(music.bpm)
      const token = audio.schedule((time) => {
        pending.delete(key)
        if (disposed || status !== "playing") return
        if (audio.trigger(event.trackId, event.pitch, duration, time, event.velocity) === false &&
            !unavailableTrackIds.includes(event.trackId)) {
          unavailableTrackIds.push(event.trackId)
          emit()
        }
      }, atSeconds)
      pending.set(key, { token, event, cycle })
    }
  }

  /** Mantém uma janela curta à frente do relógio; o loop cria ciclos sucessivos. */
  function pulse() {
    if (status !== "playing") return
    const now = audio.now()
    const absolute = absoluteTickAt(now)
    if (!loopEnabled && absolute >= range.endTick) { controller.stop(); return }
    positionTick = visibleTickAt(now)
    const length = range.endTick - range.startTick
    const until = Math.min(loopEnabled ? Infinity : range.endTick, absoluteTickAt(now + 0.2))
    const firstCycle = loopEnabled ? Math.max(0, Math.floor((absolute - range.startTick) / length)) : 0
    const lastCycle = loopEnabled ? Math.floor((until - range.startTick) / length) : 0
    for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
      const from = Math.max(absolute, range.startTick + cycle * length)
      const to = Math.min(until, range.endTick + cycle * length)
      if (to > from) scheduleSegment(cycle, from, to)
    }
    // Só a passagem atual e a próxima precisam permanecer em memória.
    for (const key of seen) if (Number(key.split(":", 1)[0]) < firstCycle - 1) seen.delete(key)
    emit()
  }

  /** Inicia pulsos periódicos sem acumular timers após pausar ou parar. */
  function startPulses() {
    if (pulseTimer !== null) timer.clearInterval(pulseTimer)
    pulseTimer = timer.setInterval(pulse, 25)
    pulse()
  }

  const controller = {
    /** Carrega faixas audíveis e inicia o primeiro ciclo no documento recebido. */
    async play(nextMusic) {
      if (disposed) return
      controller.stop()
      music = nextMusic
      range = loopEnabled ? loopRange(music) : { startTick: 0, endTick: arrangementEndTick(music) }
      positionTick = range.startTick
      anchorTick = positionTick
      unavailableTrackIds = []
      const events = eventsInRange(music, range.startTick, range.endTick, isolatedTrackId)
      if (!events.length) { status = "error"; emit(); return }
      status = "loading"
      emit()
      const request = ++generation
      const ids = [...new Set(events.map((event) => event.trackId))]
      const tracks = ids.map((id) => music.tracks.find((track) => track.id === id))
      const results = await Promise.allSettled(tracks.map((track) => audio.loadTrack(track)))
      if (disposed || request !== generation) return
      availableTrackIds = new Set(ids.filter((_, index) => results[index].status === "fulfilled"))
      unavailableTrackIds = ids.filter((_, index) => results[index].status === "rejected")
      if (!availableTrackIds.size) { status = "error"; emit(); return }
      try { await audio.start() } catch { if (request === generation) { status = "error"; emit() }; return }
      if (disposed || request !== generation) return
      anchorSeconds = audio.now() + 0.01
      status = "playing"
      startPulses()
    },

    /** Guarda a posição da agulha e interrompe somente o transporte. */
    pause() {
      if (status !== "playing") return
      positionTick = visibleTickAt(audio.now())
      generation += 1
      clearPending()
      if (pulseTimer !== null) timer.clearInterval(pulseTimer)
      pulseTimer = null
      audio.pause()
      status = "paused"
      emit()
    },

    /** Reagenda a partir do tick pausado, inclusive caudas atravessadas. */
    async resume() {
      if (status !== "paused" || disposed) return
      const request = ++generation
      await audio.start()
      if (disposed || request !== generation) return
      anchorTick = positionTick
      anchorSeconds = audio.now() + 0.01
      seen.clear()
      status = "playing"
      startPulses()
    },

    /** Limpa eventos e volta ao início do intervalo escolhido. */
    stop() {
      generation += 1
      if (pulseTimer !== null) timer.clearInterval(pulseTimer)
      pulseTimer = null
      clearPending()
      seen.clear()
      audio.stop()
      positionTick = range.startTick
      status = "stopped"
      emit()
    },

    /** Substitui o documento; alterações dinâmicas são completadas na próxima etapa. */
    update(nextMusic) { music = nextMusic },
    setLoopEnabled(enabled) { loopEnabled = Boolean(enabled) },
    isolateTrack(trackId) { isolatedTrackId = trackId },
    tick() { return positionTick },
    /** Impede carregamentos e callbacks tardios ao desmontar a página. */
    dispose() {
      if (disposed) return
      controller.stop()
      disposed = true
      audio.dispose()
    }
  }
  return controller
}
