# Coordena a página pública e a análise de um rascunho nunca persistido.
class HarmonyController < ApplicationController
  # Inicia um exemplo explícito em Dó maior no mesmo contrato do editor completo.
  def show
    @document = initial_music.to_h
    @state = Music::HarmonyLane.new(Music::Composition.from_h(@document)).to_h
    @tonics = Music::MusicalContext::TONICS
  end

  # Lê o documento atual e, se solicitado, devolve uma prévia sem alterar MIDI.
  def assist
    payload = params[:document]
    raise ArgumentError, "documento deve ser um objeto" unless payload.is_a?(ActionController::Parameters)

    music = Music::Composition.from_h(payload.to_unsafe_h)
    lane = Music::HarmonyLane.new(music)
    preview = case params[:operation]
    when "analyze" then nil
    when "generate" then Music::HarmonyGenerator.new(lane).preview(mode: :generate)
    when "continue" then Music::HarmonyGenerator.new(lane).preview(mode: :continue)
    else raise ArgumentError, "operação desconhecida"
    end
    render json: { state: lane.to_h, preview: preview }
  rescue ArgumentError => error
    render json: { error: error.message }, status: :unprocessable_entity
  end

  private

  # Monta a forma mínima da sessão; nenhuma instância ActiveRecord é criada.
  def initial_music
    region = Music::MidiRegion.new(id: "region", start_tick: 0, duration_ticks: 480, notes: [])
    track = Music::Track.new(id: "harmony", name: "Harmonia", instrument_id: "piano",
      volume: 1, mute: false, solo: false, regions: [ region ])
    Music::Composition.new(id: SecureRandom.uuid, name: "Harmonia guiada", bpm: 120,
      time_signature: { "numerator" => 4, "denominator" => 4 }, tracks: [ track ],
      context: Music::MusicalContext.new(tonic: "C", mode: "major"))
  end
end
