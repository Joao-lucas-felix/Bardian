require "test_helper"

# Confere que a orientação lê o documento e nunca reescreve eventos MIDI.
class MusicCompositionAssistantTest < ActiveSupport::TestCase
  # Uma nota fora da escala é informada sem remover o evento original.
  test "identifica notas fora do contexto e sugere sobre a selecao real" do
    music = composition([ 60, 64, 66 ])
    result = Music::CompositionAssistant.new(music).analyze(track_id: "track", region_id: "region", note_ids: %w[note-1 note-2])
    assert_equal [ "note-3" ], result.fetch("out_of_context_ids")
    assert_equal "C", result.fetch("suggestions").first.fetch("symbol")
    assert_equal 2, result.fetch("suggestions").first.fetch("matching_notes")
    assert_equal [ 60, 64, 67 ], result.fetch("suggestions").first.fetch("pitches")
    assert_equal [ 60, 64, 66 ], music.tracks.first.regions.first.notes.map(&:pitch)
  end

  test "sem contexto fica neutro e bateria nao recebe analise tonal" do
    music = composition([ 60 ], context: nil)
    neutral = Music::CompositionAssistant.new(music).analyze(track_id: "track", region_id: "region", note_ids: [])
    assert_equal "uncontextualized", neutral.fetch("status")
    assert_equal [], neutral.fetch("suggestions")
    drums = composition([ 38 ], instrument: "drums")
    result = Music::CompositionAssistant.new(drums).analyze(track_id: "track", region_id: "region", note_ids: [])
    assert_equal "non_tonal_track", result.fetch("status")
    assert_equal 7, result.fetch("field").length
    assert_equal [], result.fetch("out_of_context_ids")
    assert_equal [], result.fetch("suggestions")
  end

  test "rejeita selecao que nao pertence a regiao" do
    music = composition([ 60 ])
    assert_raises(ArgumentError) { Music::CompositionAssistant.new(music).analyze(track_id: "track", region_id: "region", note_ids: [ "outra" ]) }
  end

  # Uma fonte futura recebe a seleção validada sem acessar view ou áudio.
  test "aceita fonte de sugestoes pelo contrato call" do
    music = composition([ 60 ])
    source = ->(field:, selected:, region:) {
      assert_equal "I", field.degrees.first.numeral
      assert_equal [ 60 ], selected.map(&:pitch)
      assert_equal "region", region.id
      [ { "symbol" => "possibilidade" } ]
    }
    result = Music::CompositionAssistant.new(music, suggestion_source: source).analyze(
      track_id: "track", region_id: "region", note_ids: [ "note-1" ])
    assert_equal "possibilidade", result.fetch("suggestions").first.fetch("symbol")
  end

  private

  # Produz eventos conhecidos para testar a leitura sem fixture de persistência.
  def composition(pitches, context: { "tonic" => "C", "mode" => "major" }, instrument: "piano")
    notes = pitches.each_with_index.map do |pitch, index|
      Music::NoteEvent.new(id: "note-#{index + 1}", pitch: pitch, onset_tick: 0, duration_ticks: 480, velocity: 100)
    end
    region = Music::MidiRegion.new(id: "region", start_tick: 0, duration_ticks: 1920, notes: notes)
    track = Music::Track.new(id: "track", name: "Faixa", instrument_id: instrument, volume: 1, mute: false, solo: false, regions: [ region ])
    Music::Composition.new(id: "song", name: "Ideia", bpm: 120, time_signature: { "numerator" => 4, "denominator" => 4 },
      tracks: [ track ], context: context && Music::MusicalContext.from_h(context))
  end
end
