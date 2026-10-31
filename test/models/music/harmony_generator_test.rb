require "test_helper"

# Garante que a geração propõe graus sem alterar a faixa real da sessão.
class MusicHarmonyGeneratorTest < ActiveSupport::TestCase
  # Escolhas determinísticas deixam visível a regra entre funções harmônicas.
  class FirstChoice
    def rand(max)
      raise ArgumentError, "sem candidatos" unless max.positive?

      0
    end
  end

  test "gera quatro tempos desde a tonica sem editar o documento" do
    composition = music([])
    before = composition.to_h
    preview = Music::HarmonyGenerator.new(Music::HarmonyLane.new(composition), random: FirstChoice.new).preview(mode: :generate)

    assert_equal [ 0, 480, 960, 1440 ], preview.map { |item| item.fetch("onset_tick") }
    assert_equal %w[I ii V I], preview.map { |item| item.fetch("degree") }
    assert_equal [ 60, 64, 67 ], preview.first.fetch("pitches")
    assert_equal before, composition.to_h
  end

  test "continua a partir da ultima triade midi reconhecida" do
    lane = Music::HarmonyLane.new(music([ [ 60, 64, 67 ], [ 65, 69, 72 ], [ 67, 71, 74 ] ]))
    preview = Music::HarmonyGenerator.new(lane, random: FirstChoice.new).preview(mode: :continue)

    assert_equal lane.next_onset_tick, preview.first.fetch("onset_tick")
    assert_equal %w[I ii V I], preview.map { |item| item.fetch("degree") }
    assert_equal [ 1440, 1920, 2400, 2880 ], preview.map { |item| item.fetch("onset_tick") }
  end

  test "menor natural inicia em i e preserva v menor" do
    lane = Music::HarmonyLane.new(music([], tonic: "A", mode: "natural_minor"))
    preview = Music::HarmonyGenerator.new(lane, random: FirstChoice.new).preview(mode: :generate)

    assert_equal %w[i ii° v i], preview.map { |item| item.fetch("degree") }
    assert_equal "Em", preview[2].fetch("symbol")
  end

  test "rejeita operacao indevida ultimo acorde fora do campo e falta de espaco" do
    empty = Music::HarmonyLane.new(music([]))
    assert_raises(ArgumentError) { Music::HarmonyGenerator.new(empty).preview(mode: :continue) }
    assert_raises(ArgumentError) { Music::HarmonyGenerator.new(empty).preview(mode: :unknown) }

    outside = Music::HarmonyLane.new(music([ [ 60, 64, 67 ] ], tonic: "D"))
    assert_raises(ArgumentError) { Music::HarmonyGenerator.new(outside).preview(mode: :continue) }

    full = Music::HarmonyLane.new(music(Array.new(29) { [ 60, 64, 67 ] }))
    assert_raises(ArgumentError) { Music::HarmonyGenerator.new(full).preview(mode: :continue) }
  end

  private

  # Mantém eventos reais, com início por batida, para testar a continuação.
  def music(chords, tonic: "C", mode: "major")
    notes = chords.each_with_index.flat_map do |pitches, index|
      pitches.each_with_index.map do |pitch, voice|
        Music::NoteEvent.new(id: "n#{index}-#{voice}", pitch: pitch, onset_tick: index * 480,
          duration_ticks: 480, velocity: 90)
      end
    end
    region = Music::MidiRegion.new(id: "region", start_tick: 0,
      duration_ticks: [ chords.length, 1 ].max * 480, notes: notes)
    track = Music::Track.new(id: "harmony", name: "Harmonia", instrument_id: "piano",
      volume: 1, mute: false, solo: false, regions: [ region ])
    Music::Composition.new(id: "draft", name: "Harmonia guiada", bpm: 120,
      time_signature: { "numerator" => 4, "denominator" => 4 }, tracks: [ track ],
      context: Music::MusicalContext.new(tonic: tonic, mode: mode))
  end
end
