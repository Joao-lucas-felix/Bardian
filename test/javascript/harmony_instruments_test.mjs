import assert from "node:assert/strict"
import test from "node:test"

test("presets aplicam envelope filtro e ganho distintos sem samples externos", async () => {
  const { HARMONY_INSTRUMENTS, configureHarmonyInstrument } = await import("../../app/audio_engine/harmony_instruments.js")
  const results = []
  for (const id of Object.keys(HARMONY_INSTRUMENTS).filter(id => HARMONY_INSTRUMENTS[id].source === "vaporisateur")) {
    const values = {}
    /** Simula somente os setters na fronteira do SDK, registrando parâmetros aplicados. */
    const field = key => ({ setValue(value) { values[key] = value } })
    const oscillators = [0, 1].map(i => ({ waveform: field(`wave${i}`), volume: field(`gain${i}`) }))
    const box = Object.fromEntries(["attack", "decay", "sustain", "release", "cutoff", "voicingMode"].map(key => [key, field(key)]))
    box.oscillators = { fields: () => oscillators }
    configureHarmonyInstrument(box, id, { triangle: 1, saw: 2, square: 3 }, 7)
    assert.ok(values.attack > 0 && values.release > 0)
    assert.ok(values.cutoff > 0 && values.gain0 < 0)
    assert.equal(values.gain1, -Infinity)
    assert.equal(values.voicingMode, 7)
    results.push(JSON.stringify(values))
  }
  assert.equal(new Set(results).size, 4)
  assert.throws(() => configureHarmonyInstrument({}, "unknown", {}, 7), /Instrumento/)
})
