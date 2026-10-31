/** Localiza exatamente um preset por banco/programa MIDI; nunca usa fallback sonoro. */
export function resolvePresetIndex(presets, bank, program) {
  const matches = presets.flatMap((preset, index) => preset.header.bank === bank && preset.header.preset === program ? [index] : [])
  if (matches.length !== 1) throw new Error('Timbre não encontrado no banco instalado')
  return matches[0]
}

/** Aguarda operação sem deixar cancelamentos antigos alterarem a sessão atual. */
export function abortable(promise, signal) {
  if (!signal) return promise
  return new Promise((resolve, reject) => {
    const cancel = () => { signal.removeEventListener('abort', cancel); reject(signal.reason) }
    signal.addEventListener('abort', cancel, { once: true })
    promise.then(value => { signal.removeEventListener('abort', cancel); resolve(value) }, error => { signal.removeEventListener('abort', cancel); reject(error) })
    if (signal.aborted) cancel()
  })
}

/** Calcula SHA-256 no navegador para rejeitar cache ou download corrompido. */
async function sha256(buffer) {
  const result = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Implementa SoundfontLoaderManager e SoundfontLoader para um banco instalado.
 * storage/option/parse são APIs fornecidas pelo SDK; fetcher/digest permitem testar
 * as bordas. Compartilha leitura e parsing entre faixas, valida bytes, recupera
 * cache corrompido e publica toda falha, inclusive parsing e quota OPFS.
 * ensure retorna o banco interpretado; dispose cancela a carga desta sessão.
 */
export function createSoundfontBank({ definition, uuid, storage, option, parse, fetcher = globalThis.fetch, digest = sha256, timeoutMs = 180000 }) {
  let state = { type: 'idle' }, soundfont = option.None, pending, controller, disposed = false
  const observers = new Set()
  const key = Array.from(uuid).join(',')
  /** Publica estados do contrato SDK; fase é informação adicional para o Bardian. */
  function publish(next) { state = next; for (const observer of observers) observer(next) }
  /** Rejeita arquivos truncados, trocados ou inconsistentes antes do parser. */
  async function validate(buffer) {
    if (buffer.byteLength !== definition.size || await digest(buffer) !== definition.sha256) throw new Error('Banco de instrumentos incompleto ou corrompido')
  }
  /** Baixa uma vez, limita bytes ao tamanho conhecido e reporta transferência real. */
  async function download(signal) {
    const response = await fetcher(definition.path, { signal, cache: 'default' })
    if (!response.ok) throw new Error('Não foi possível baixar os instrumentos. Tente novamente')
    const bytes = new Uint8Array(definition.size)
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Download dos instrumentos indisponível')
    let offset = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        signal.throwIfAborted()
        if (done) break
        if (offset + value.byteLength > bytes.length) throw new Error('Banco de instrumentos com tamanho inesperado')
        bytes.set(value, offset); offset += value.byteLength
        publish({ type: 'progress', progress: offset / bytes.length, phase: 'download' })
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    if (offset !== bytes.length) throw new Error('Download dos instrumentos incompleto')
    return bytes.buffer
  }
  /** Carrega OPFS, recupera bytes inválidos e salva apenas um banco verificado. */
  async function load(signal) {
    publish({ type: 'progress', progress: 0, phase: 'prepare' })
    let cached
    try { [cached] = await storage.load(uuid) } catch { /* Cache ausente: a gravação posterior confirma disponibilidade. */ }
    signal.throwIfAborted()
    if (cached) {
      try {
        await validate(cached)
        const parsed = await parse(cached)
        signal.throwIfAborted()
        return parsed
      } catch (error) {
        signal.throwIfAborted()
        await storage.deleteItem(uuid)
        cached = undefined
      }
    }
    const bytes = await download(signal)
    publish({ type: 'progress', progress: 1, phase: 'prepare' })
    await validate(bytes)
    signal.throwIfAborted()
    let parsed
    try { parsed = await parse(bytes) } catch { throw new Error('Não foi possível interpretar o banco de instrumentos') }
    signal.throwIfAborted()
    try { await storage.save({ uuid, file: bytes, meta: { name: definition.name, size: definition.size, url: definition.path, license: definition.license, origin: 'import' } }) }
    catch { throw new Error('Não foi possível armazenar os instrumentos neste navegador. Confira o espaço disponível') }
    signal.throwIfAborted()
    return parsed
  }
  /** Inicia uma tentativa compartilhada, com prazo limitado e falha observável. */
  function begin() {
    if (disposed) return Promise.reject(new Error('Áudio encerrado'))
    if (pending) return pending
    controller = new AbortController()
    const signal = controller.signal
    const timer = setTimeout(() => controller.abort(new Error('Os instrumentos demoraram para carregar. Tente novamente')), timeoutMs)
    pending = abortable(load(signal), signal).then(parsed => {
      signal.throwIfAborted()
      soundfont = option.wrap(parsed); publish({ type: 'loaded' }); return parsed
    }, error => { soundfont = option.None; publish({ type: 'error', reason: error.message }); throw error })
      .finally(() => clearTimeout(timer))
    // O SDK pode solicitar a carga antes de um consumidor chamar ensure.
    pending.catch(() => {})
    return pending
  }
  const loader = {
    uuid,
    get state() { return state },
    get soundfont() { return soundfont },
    /** Replay assíncrono permite ao SDK guardar a assinatura antes de terminá-la. */
    subscribe(observer) {
      observers.add(observer)
      queueMicrotask(() => { if (observers.has(observer)) observer(state) })
      return { terminate() { observers.delete(observer) } }
    },
    /** Reinicia somente tentativa finalizada; chamadas simultâneas compartilham carga. */
    invalidate() { if (state.type === 'error') { pending = undefined; void begin() } }
  }
  return {
    /** Recusa bancos não instalados em vez de buscar URLs recebidas do documento. */
    getOrCreate(id) {
      if (Array.from(id).join(',') !== key) throw new Error('Banco de instrumentos indisponível')
      void begin(); return loader
    },
    invalidate() { loader.invalidate() },
    remove() { /* O banco pertence à sessão inteira, não a uma faixa isolada. */ },
    /** Aguarda banco e acompanha progresso; cancelar um consumidor preserva os demais. */
    async ensure({ onProgress = () => {}, signal } = {}) {
      signal?.throwIfAborted()
      if (state.type === 'error') pending = undefined
      const subscription = loader.subscribe(onProgress)
      try { return await abortable(begin(), signal) } finally { subscription.terminate() }
    },
    /** Libera assinaturas e interrompe download ao sair da página. */
    dispose() { disposed = true; controller?.abort(); observers.clear(); soundfont = option.None; pending = undefined }
  }
}
