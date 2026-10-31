/**
 * Controla intenção de transporte e sessão preparada. Posições públicas usam ticks
 * do documento; só o motor conhece PPQN. Promessas antigas nunca iniciam áudio.
 */
export function createHarmonyPlayback({
  loader = () => import("/audio-engine/engine.js?v=5"),
  contextFactory = () => new AudioContext({ latencyHint: "interactive" }),
  onState = () => {}
} = {}) {
  let context, loading, engine, preparedKey, mainDocument
  let revision = 0, session = 0, positionTick = 0, endTick = 0
  let preparation = Promise.resolve(), preparationController
  let warming
  let disposed = false, status = "stopped", mode = "main"

  /** Publica cópia do estado, sem permitir ao consumidor alterar o relógio interno. */
  function publish(next = status, details = {}) { status = next; onState({ status, positionTick, ...details }) }

  /** Calcula extensão por blocos e eventos, sem confundir padding com música. */
  function endOf(document) {
    return Math.max(0, ...(document.harmony?.blocks || []).map(block => block.onset_tick + block.duration_ticks),
      ...(document.tracks || []).flatMap(track => track.regions.flatMap(region => region.notes.map(note => region.start_tick + note.onset_tick + note.duration_ticks))))
  }

  /** Uma carga compartilhada por pedidos concorrentes; cada tentativa possui seu contexto. */
  async function ready() {
    if (disposed) throw new Error("Áudio encerrado")
    context ||= contextFactory()
    const ownContext = context
    await ownContext.resume()
    if (!loading) loading = loader().then(module => module.createHarmonyEngine(ownContext)).then(value => {
      if (disposed) { value.dispose(); throw new Error("Áudio encerrado") }
      engine = value
      return value
    }).catch(async error => {
      loading = null
      if (ownContext.state !== "closed") await ownContext.close()
      if (context === ownContext) context = null
      throw error
    })
    return loading
  }

  /** Prepara somente quando conteúdo ou tipo de escuta mudou; hooks pertencem à sessão. */
  async function prepare(current, document, kind, token, signal) {
    const key = JSON.stringify([kind, document])
    if (key === preparedKey) return
    const ownSession = ++session
    preparedKey = null
    await current.prepare(document, {
      signal,
      onProgress(state) {
        if (!disposed && token === revision) publish("loading", { progress: state.phase === "download" ? state.progress : undefined })
      },
      onPosition(tick) {
        if (disposed || ownSession !== session || mode !== "main" || status !== "playing") return
        positionTick = Math.max(0, Math.min(endTick, tick)); publish()
      },
      onEnded() {
        if (disposed || ownSession !== session || status !== "playing") return
        if (mode === "preview") { mode = "main"; preparedKey = null; publish("paused") }
        else { positionTick = 0; publish("stopped") }
      }
    })
    if (!disposed && token === revision) preparedKey = key
  }

  /** Prepara ou inicia o snapshot atual; `autoplay` distingue seleção de escuta. */
  async function start(document, kind, autoplay = true) {
    preparationController?.abort()
    preparationController = new AbortController()
    const signal = preparationController.signal
    const token = ++revision, snapshot = structuredClone(document)
    engine?.pause()
    mode = kind
    if (kind === "main") {
      mainDocument = snapshot; endTick = endOf(snapshot)
      if (positionTick >= endTick) positionTick = 0
    }
    publish("loading")
    try {
      const current = await ready()
      if (disposed || token !== revision) return
      // Serializa montagem de grafos; uma tentativa antiga nunca sobrescreve a atual.
      const ownPreparation = preparation.catch(() => {}).then(() => {
        if (disposed || token !== revision) return
        return prepare(current, snapshot, kind, token, signal)
      })
      preparation = ownPreparation
      await ownPreparation
      if (disposed || token !== revision) return
      if (autoplay) {
        current.seek(kind === "main" ? positionTick : 0)
        current.play()
        publish("playing")
      } else publish("stopped")
    } catch (error) {
      if (!disposed && token === revision) { preparedKey = null; publish("error"); throw error }
    }
  }

  return {
    /** Reutiliza sessão intacta após pausa; documento não é modificado. */
    async play(document) {
      // O clique durante a preparação da mesma escolha espera a unidade pronta.
      const pending = warming
      if (pending?.key === JSON.stringify(["main", document])) {
        const intent = revision
        try { await pending.promise } catch { /* A escuta atual tenta novamente. */ }
        if (disposed || intent !== revision) return
      }
      return start(document, "main")
    },
    /** Prepara o timbre escolhido após o gesto do usuário, sem iniciar o relógio. */
    warm(document) {
      const pending = { key: JSON.stringify(["main", document]), promise: start(document, "main", false) }
      warming = pending
      void pending.promise.then(() => { if (warming === pending) warming = null }, () => { if (warming === pending) warming = null })
      return pending.promise
    },
    /** Interrompe início pendente e preserva a posição principal. */
    pause() { preparationController?.abort(); revision += 1; engine?.pause(); if (mode === "preview") preparedKey = null; mode = "main"; publish("paused") },
    /** Limita cursor; durante carga apenas atualiza a intenção que start consultará. */
    seek(tick) {
      if (!Number.isFinite(tick)) return
      positionTick = Math.max(0, Math.min(endTick, Math.round(tick)))
      if (mode === "preview") { revision += 1; engine?.pause(); mode = "main"; preparedKey = null; publish("paused") }
      if (status !== "loading" && preparedKey) engine?.seek(positionTick)
      if (status === "playing" && positionTick >= endTick) { this.stop(); return }
      publish()
    },
    /** Para e zera inclusive com carga pendente; mantém recursos reutilizáveis. */
    stop() { preparationController?.abort(); revision += 1; engine?.stop(); mode = "main"; positionTick = 0; publish("stopped") },
    /** Edição invalida grafo anterior, mas conserva o cursor dentro da nova extensão. */
    update(document) {
      preparationController?.abort(); revision += 1; session += 1; engine?.pause(); preparedKey = null; mode = "main"
      mainDocument = structuredClone(document); endTick = endOf(document)
      positionTick = Math.min(positionTick, endTick); publish("stopped")
    },
    /** Toca somente a tríade proposta; nunca copia notas adicionais para a pré-escuta. */
    audition(document, pitches) {
      const preview = structuredClone(document)
      const track = preview.tracks.find(track => track.id === `harmony-${document.id}`) || preview.tracks[0]
      preview.tracks = [track]; delete preview.harmony
      track.regions = [{ id: "preview-region", start_tick: 0, duration_ticks: 480,
        notes: pitches.map((pitch, i) => ({ id: `preview-${i}`, pitch, onset_tick: 0, duration_ticks: 480, velocity: 90 })) }]
      return this.preview(preview)
    },
    /** Escuta temporária pausa principal sem alterar seu cursor ou retomá-la sozinha. */
    preview(document) { return start(document, "preview") },
    setLoopEnabled() {},
    /** Desmontagem idempotente encerra assinaturas e o contexto pertencente à sessão. */
    dispose() {
      if (disposed) return
      preparationController?.abort(); disposed = true; revision += 1; session += 1
      engine?.dispose()
      if (context && context.state !== "closed") void context.close()
    }
  }
}
