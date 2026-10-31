import { Option, UUID } from "@opendaw/lib-std"
import { SoundfontFileBox } from "@opendaw/studio-boxes"
import soundfonts from "../../config/soundfonts.json" with { type: "json" }
import { createSoundfontBank, resolvePresetIndex, abortable } from "./harmony_soundfonts.js"
import { AnimationFrame } from "@opendaw/lib-dom"
import { PPQN, ClassicWaveform } from "@opendaw/lib-dsp"
import { VoicingMode } from "@opendaw/studio-enums"
import { HARMONY_INSTRUMENTS, configureHarmonyInstrument } from "./harmony_instruments.js"
import { syncHarmonyTracks } from "./harmony_track_cache.js"
import { BpmDetector, InstrumentFactories } from "@opendaw/studio-adapters"
import { AudioWorklets, Workers, Project, GlobalSampleLoaderManager, SoundfontStorage, SoundfontService, SampleService } from "@opendaw/studio-core"
import { WasmEngine } from "@opendaw/studio-core-wasm"
import workersUrl from "@opendaw/studio-core/workers-main.js?worker&url"
import workletsUrl from "@opendaw/studio-core/processors.js?url"
import processorUrl from "@opendaw/studio-core-wasm/wasm-processor.js?url"
import offlineWorkerUrl from "@opendaw/studio-core-wasm/wasm-offline-worker.js?worker&url"
import { mapHarmonyDocument } from "../javascript/composition/opendaw_mapping.js"

let installation

/** Instala serviços globais uma vez; a sessão musical e seu AudioContext são descartáveis. */
function install() {
  if (!installation) installation = (async () => {
    AnimationFrame.start(window)
    // Invalida respostas antigas que ainda não incluíam o isolamento do worker.
    await Workers.install(`${workersUrl}?isolation=1`)
    AudioWorklets.install(workletsUrl)
    // O SDK acrescenta /wasm ao diretório-base informado.
    WasmEngine.install({ processorUrl, offlineWorkerUrl, wasmUrl: "/audio-engine" })
  })().catch((error) => { installation = null; throw error })
  return installation
}

/** Impede que uma falha do worklet deixe a interface indefinidamente em carregamento. */
async function deadline(promise, milliseconds) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("O som demorou para carregar. Recarregue a página e tente novamente.")), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

/**
 * Cria uma sessão exclusivamente para harmonia. O contexto é fornecido após gesto
 * do usuário. O banco distribuído pelo Bardian é carregado sob demanda e compartilhado na sessão.
 */
export async function createHarmonyEngine(context) {
  if (!globalThis.crossOriginIsolated) throw new Error("Reabra esta página para habilitar o áudio")
  await deadline(install(), 30000)
  await deadline(AudioWorklets.createFor(context), 30000)
  // Os módulos WASM são globais, mas cada AudioContext precisa registrar seu
  // próprio AudioWorkletProcessor antes de criar um projeto após uma nova tentativa.
  if (WasmEngine.isReady()) await deadline(context.audioWorklet.addModule(processorUrl), 30000)
  else if (!await deadline(WasmEngine.ensureReady(context), 60000)) throw new Error("Não foi possível iniciar o áudio neste navegador")
  const unavailable = { async fetch() { throw new Error("Fonte externa não habilitada") } }
  const definition = soundfonts.fluid_r3
  const bankUuid = UUID.parse(definition.uuid)
  const soundfontManager = createSoundfontBank({ definition, uuid: bankUuid,
    storage: SoundfontStorage.get(), option: Option,
    parse: async buffer => {
      const { SoundFont2 } = await import("soundfont2")
      return new SoundFont2(new Uint8Array(buffer))
    } })
  const project = Project.new({ audioContext: context, audioWorklets: AudioWorklets.get(context),
    sampleManager: new GlobalSampleLoaderManager(unavailable), soundfontManager,
    sampleService: new SampleService(context, BpmDetector.Unknown),
    soundfontService: new SoundfontService() })
  let instrumentSlots = []
  let end = 0
  let ended = () => {}
  let observed = () => {}
  let playing = false
  let subscription
  try {
    project.startAudioWorklet()
    await deadline(project.engine.isReady(), 30000)
    subscription = project.engine.position.subscribe((position) => {
      if (!playing) return
      observed(position.getValue() * 480 / PPQN.Quarter)
      if (end && position.getValue() >= end) {
        project.engine.stop(true)
        playing = false
        ended()
      }
    })
  } catch (error) { project.terminate(); throw error }

  return {
    /** Substitui a sessão executável a partir do documento, preservando o JSON de origem. */
    async prepare(document, { onEnded = () => {}, onPosition = () => {}, onProgress = () => {}, signal } = {}) {
      const mapped = mapHarmonyDocument(document, PPQN.Quarter, Object.keys(HARMONY_INSTRUMENTS))
      const usesSoundfont = mapped.tracks.some(track => HARMONY_INSTRUMENTS[track.instrumentId].source === "fluid_r3")
      const font = usesSoundfont ? await soundfontManager.ensure({ onProgress, signal }) : null
      signal?.throwIfAborted()
      const indices = new Map(mapped.tracks.filter(track => HARMONY_INSTRUMENTS[track.instrumentId].source === "fluid_r3").map(track => {
        const preset = HARMONY_INSTRUMENTS[track.instrumentId]
        return [track.instrumentId, resolvePresetIndex(font.presets, preset.bank, preset.program)]
      }))
      project.engine.stop(true)
      ended = onEnded
      observed = onPosition
      playing = false
      project.editing.modify(() => {
        project.api.setBpm(mapped.bpm)
        project.timelineBox.loopArea.enabled.setValue(false)
        instrumentSlots = syncHarmonyTracks(project, instrumentSlots, mapped.tracks, track => {
          const sampled = indices.has(track.instrumentId)
          // O SDK remove arquivos sem referências; buscar no grafo evita reaproveitar caixa desanexada.
          const soundfontFile = sampled ? project.boxGraph.findBox(bankUuid).unwrapOrElse(() =>
            SoundfontFileBox.create(project.boxGraph, bankUuid, box => box.fileName.setValue(definition.name))) : undefined
          const product = project.api.createInstrument(sampled ? InstrumentFactories.Soundfont : InstrumentFactories.Vaporisateur,
            { name: track.name, attachment: sampled ? soundfontFile : undefined })
          if (sampled) product.instrumentBox.presetIndex.setValue(indices.get(track.instrumentId))
          else configureHarmonyInstrument(product.instrumentBox, track.instrumentId, ClassicWaveform, VoicingMode.Polyphonic)
          return product
        })
      })
      end = mapped.end
      // O relógio só inicia após o worklet receber instrumentos e amostras.
      const until = performance.now() + 60000
      do {
        signal?.throwIfAborted()
        await abortable(new Promise(resolve => setTimeout(resolve, 30)), signal)
        if (await abortable(deadline(project.engine.queryLoadingComplete(), Math.max(1, until - performance.now())), signal)) return
      } while (performance.now() < until)
      throw new Error("Os instrumentos demoraram para ficar prontos. Tente novamente")
    },
    /** Retoma o grafo preparado a partir da posição nativa, sem recriar instrumentos. */
    play() { playing = true; project.engine.play() },
    /** Pausa o relógio sem resetar a posição nem descartar a sessão preparada. */
    pause() { playing = false; project.engine.stop(false) },
    /** Move o relógio nativo; a unidade pública continua sendo tick do contrato. */
    seek(tick) { project.engine.setPosition(tick * PPQN.Quarter / 480) },
    /** Interrompe o relógio e todas as notas atuais sem destruir a sessão. */
    stop() { playing = false; project.engine.stop(true) },
    /** Libera observadores, grafo e processador; o proprietário encerra o AudioContext. */
    dispose() { soundfontManager.dispose(); subscription?.terminate(); project.terminate() }
  }
}
