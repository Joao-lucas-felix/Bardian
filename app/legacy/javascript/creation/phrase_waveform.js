/**
 * Desenha uma prévia decorativa a partir dos eventos MIDI, nunca do áudio.
 * @param {HTMLCanvasElement} canvas Superfície da frase.
 * @param {Array<{onset: number, duration: number, velocity: number}>} notes Eventos em ticks.
 * @param {{totalTicks: number, color: string, pixelRatio?: number}} options Extensão e cor da faixa.
 * @returns {void} O desenho não modifica as notas recebidas.
 */
export function drawPhraseWaveform(canvas, notes, { totalTicks, color, pixelRatio = globalThis.devicePixelRatio || 1 }) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height || !totalTicks) return
  const context = canvas.getContext("2d")
  if (!context) return
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.strokeStyle = "rgba(255, 255, 255, .2)"
  for (let beat = 1; beat < 4; beat += 1) {
    const x = width * beat / 4
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }

  const count = Math.max(1, Math.floor(width / 5))
  const barWidth = width / count
  context.fillStyle = color
  for (let index = 0; index < count; index += 1) {
    const startTick = index / count * totalTicks
    const endTick = (index + 1) / count * totalTicks
    const matching = notes.filter((note) => note.onset < endTick && note.onset + note.duration > startTick && note.onset < totalTicks)
    if (!matching.length) continue
    const intensity = Math.min(1, matching.reduce((sum, note) => sum + Math.max(0, Math.min(127, note.velocity)) / 127, 0))
    const ripple = .62 + .38 * Math.abs(Math.sin(index * 2.17))
    const barHeight = Math.min(height - 4, Math.max(3, (height - 8) * intensity * ripple))
    context.fillRect(index * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight)
  }
}
