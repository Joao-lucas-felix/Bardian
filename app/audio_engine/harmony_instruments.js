import definitions from "../../config/harmony_instruments.json" with { type: "json" }

/** Catálogo único compartilhado com Rails; Vite incorpora os dados no bundle local. */
export const HARMONY_INSTRUMENTS = Object.freeze(definitions)

/**
 * Aplica preset à caixa Vaporisateur. Enums são recebidos do SDK pelo chamador;
 * osciladores e envelopes não vazam para o documento musical.
 */
export function configureHarmonyInstrument(box, id, waveforms, polyphonicMode) {
  const preset = HARMONY_INSTRUMENTS[id]
  if (!Object.hasOwn(HARMONY_INSTRUMENTS, id) || preset.source !== "vaporisateur") throw new Error("Instrumento indisponível")
  for (const field of ["attack", "decay", "sustain", "release", "cutoff"]) box[field].setValue(preset[field])
  box.voicingMode.setValue(polyphonicMode)
  const oscillators = box.oscillators.fields()
  oscillators[0].waveform.setValue(waveforms[preset.waveform])
  oscillators[0].volume.setValue(preset.gain_db)
  oscillators[1].volume.setValue(-Infinity)
}
