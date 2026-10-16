import { arrangementEndTick, audibleTrackIds, eventsInRange, loopRange, secondsPerTick } from "composition/playback_events"

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
  let pendingRange = null
  let pendingLoopEnabled = null
  let pendingWrapAt = null
  let isolatedTrackId = null
  let unavailableTrackIds = []
  let availableTrackIds = new Set()
  const loadedInstrumentIds = new Map()
  let generation = 0
  let pulseTimer = null
  let disposed = false
  const pending = new Map()
  const seen = new Set()
  const loadingTrackIds = new Set()

  /** Envia um estado independente, sem entregar coleções internas mutáveis. */
  function emit() {
    if (!disposed) onState({ status, tick: positionTick,
      loopEnabled: pendingLoopEnabled ?? loopEnabled, unavailableTrackIds: [...unavailableTrackIds] })
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
    for (const [key, entry] of pending) {
      audio.cancel(entry.token)
      seen.delete(key)
    }
    pending.clear()
  }

  /** Seleciona o intervalo pretendido sem deslocar o ciclo em andamento. */
  function desiredRange(nextMusic, enabled = loopEnabled) {
    return enabled ? loopRange(nextMusic) : { startTick: 0, endTick: arrangementEndTick(nextMusic) }
  }

  /** Fixa a borda futura no instante da edição, antes que o relógio a ultrapasse. */
  function queueRange(nextRange, enabled = null) {
    const length = range.endTick - range.startTick
    const absolute = absoluteTickAt(audio.now())
    const cycle = loopEnabled ? Math.max(0, Math.floor((absolute - range.startTick) / length)) : 0
    const wrapTick = range.endTick + cycle * length
    pendingWrapAt = anchorSeconds + (wrapTick - anchorTick) * secondsPerTick(music.bpm)
    pendingRange = nextRange
    pendingLoopEnabled = enabled
  }

  /** Silencia faixas excluídas da mixagem e ajusta ganho das restantes. */
  function syncTrackLevels() {
    if (!music) return
    const allowed = new Set(audibleTrackIds(music, isolatedTrackId))
    for (const track of music.tracks) {
      if (allowed.has(track.id)) audio.setTrackVolume(track.id, track.volume)
      else audio.silenceTrack(track.id)
    }
  }

  /** Carrega sob demanda uma faixa que se tornou audível durante Play. */
  function loadNewTracks() {
    if (status !== "playing") return
    const allowed = new Set(audibleTrackIds(music, isolatedTrackId))
    for (const track of music.tracks) {
      if (!allowed.has(track.id) || availableTrackIds.has(track.id) || loadingTrackIds.has(track.id)) continue
      loadingTrackIds.add(track.id)
      audio.loadTrack(track).then(() => {
        loadingTrackIds.delete(track.id)
        if (disposed || status !== "playing" || !music.tracks.some((item) => item.id === track.id)) return
        availableTrackIds.add(track.id)
        loadedInstrumentIds.set(track.id, track.instrument_id)
        unavailableTrackIds = unavailableTrackIds.filter((id) => id !== track.id)
        syncTrackLevels()
        pulse()
      }).catch(() => {
        loadingTrackIds.delete(track.id)
        if (disposed || status !== "playing") return
        if (!unavailableTrackIds.includes(track.id)) unavailableTrackIds.push(track.id)
        emit()
      })
    }
  }

  /** Descarta apenas fontes removidas ou cujo instrumento mudou. */
  function releaseChangedTracks() {
    for (const [trackId, instrumentId] of loadedInstrumentIds) {
      const current = music.tracks.find((track) => track.id === trackId)
      if (current?.instrument_id === instrumentId) continue
      audio.disposeTrack(trackId)
      availableTrackIds.delete(trackId)
      loadedInstrumentIds.delete(trackId)
    }
  }

  /** Marca eventos já percorridos para não criar uma cauda na edição atual. */
  function markPassedEvents(now) {
    const current = visibleTickAt(now)
    const length = range.endTick - range.startTick
    const cycle = loopEnabled ? Math.max(0, Math.floor((absoluteTickAt(now) - range.startTick) / length)) : 0
    for (const event of eventsInRange(music, range.startTick, current, isolatedTrackId)) {
      seen.add(`${cycle}:${event.trackId}:${event.id}`)
    }
  }

  /** Troca marcadores na borda do ciclo, sem teletransportar a agulha. */
  function applyPendingRange(now) {
    if (!pendingRange) return
    if (now < pendingWrapAt) return
    clearPending()
    seen.clear()
    range = pendingRange
    loopEnabled = pendingLoopEnabled ?? loopEnabled
    pendingRange = null
    pendingLoopEnabled = null
    anchorTick = range.startTick
    anchorSeconds = pendingWrapAt
    pendingWrapAt = null
    positionTick = range.startTick
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
    applyPendingRange(now)
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
      range = desiredRange(music)
      pendingRange = null
      pendingLoopEnabled = null
      pendingWrapAt = null
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
      loadedInstrumentIds.clear()
      for (const track of tracks) if (availableTrackIds.has(track.id)) loadedInstrumentIds.set(track.id, track.instrument_id)
      unavailableTrackIds = ids.filter((_, index) => results[index].status === "rejected")
      if (!availableTrackIds.size) { status = "error"; emit(); return }
      try { await audio.start() } catch { if (request === generation) { status = "error"; emit() }; return }
      if (disposed || request !== generation) return
      anchorSeconds = audio.now() + 0.01
      status = "playing"
      syncTrackLevels()
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
      pendingRange = null
      pendingLoopEnabled = null
      pendingWrapAt = null
      seen.clear()
      for (const trackId of loadedInstrumentIds.keys()) audio.disposeTrack(trackId)
      loadedInstrumentIds.clear()
      availableTrackIds.clear()
      audio.stop()
      positionTick = range.startTick
      status = "stopped"
      emit()
    },

    /** Aplica edições futuras agora e adia notas já percorridas à próxima volta. */
    update(nextMusic) {
      if (!music || status !== "playing") {
        music = nextMusic
        if (music) range = desiredRange(music)
        return
      }
      const now = audio.now()
      const current = visibleTickAt(now)
      const bpmChanged = music.bpm !== nextMusic.bpm
      clearPending()
      music = nextMusic
      releaseChangedTracks()
      if (bpmChanged) {
        anchorTick = current
        anchorSeconds = now
        seen.clear()
      }
      positionTick = current
      const nextRange = desiredRange(music, pendingLoopEnabled ?? loopEnabled)
      if (nextRange.startTick !== range.startTick || nextRange.endTick !== range.endTick) queueRange(nextRange, pendingLoopEnabled)
      markPassedEvents(now)
      syncTrackLevels()
      loadNewTracks()
      pulse()
    },
    /** Muda o modo no retorno do ciclo em curso, mantendo a posição atual. */
    setLoopEnabled(enabled) {
      const requested = Boolean(enabled)
      if (status === "playing" && requested !== loopEnabled) {
        queueRange(desiredRange(music, requested), requested)
      } else {
        loopEnabled = requested
        if (music) range = desiredRange(music)
      }
      emit()
    },
    /** Isola uma faixa sem reiniciar o transporte global. */
    isolateTrack(trackId) {
      isolatedTrackId = trackId
      if (status !== "playing") return
      const now = audio.now()
      clearPending()
      markPassedEvents(now)
      syncTrackLevels()
      loadNewTracks()
      pulse()
    },
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
