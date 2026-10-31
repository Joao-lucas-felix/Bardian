require "test_helper"

# Protege a leitura harmônica derivada da única faixa MIDI da sessão guiada.
class MusicHarmonyLaneTest < ActiveSupport::TestCase
  test "oferece sete triades de do maior e reconhece acordes por classe de altura" do
    lane = Music::HarmonyLane.new(music([ [ 48, 64, 79 ], [ 65, 69, 72 ] ]))

    assert_equal 7, lane.options.length
    assert_equal %w[I ii iii IV V vi vii°], lane.options.map { |item| item.fetch("degree") }
    assert_equal [ 60, 64, 67 ], lane.options.first.fetch("pitches")
    assert_equal %w[I IV], lane.slots.map { |slot| slot.fetch("degree") }
    assert_equal 960, lane.next_onset_tick
  end

  test "avanca ao proximo compasso e limita a faixa a 32 tempos" do
    four = Music::HarmonyLane.new(music(Array.new(4) { [ 60, 64, 67 ] }))
    assert_equal 1920, four.next_onset_tick
    assert four.can_append?(4)

    full = Music::HarmonyLane.new(music(Array.new(32) { [ 60, 64, 67 ] }))
    assert_equal 15_360, full.next_onset_tick
    refute full.can_append?(1)
    refute full.to_h.fetch("can_continue")
  end

  test "explica preparacao tensao e resolucao sem numero" do
    lane = Music::HarmonyLane.new(music([ [ 60, 64, 67 ], [ 65, 69, 72 ], [ 67, 71, 74 ], [ 60, 64, 67 ] ]))

    assert_equal [ "repouso", "preparação", "tensão", "resolução" ], lane.slots.map { |slot| slot.fetch("tension") }
    assert_match(/chegada/i, lane.slots.last.fetch("explanation"))
    assert_equal 1920, lane.next_onset_tick
  end

  # A opção exibida na roda deve explicar seu papel no trecho atual.
  test "explica acordes disponiveis com base na funcao e no acorde anterior" do
    starting = Music::HarmonyLane.new(music([]))
    assert_match(/descanso/i, starting.options.find { |option| option.fetch("degree") == "I" }.fetch("explanation"))

    after_dominant = Music::HarmonyLane.new(music([ [ 67, 71, 74 ] ]))
    tonic = after_dominant.options.find { |option| option.fetch("degree") == "I" }
    assert_match(/chegada/i, tonic.fetch("explanation"))
  end

  test "menor natural nao confunde v menor com dominante maior" do
    lane = Music::HarmonyLane.new(music([ [ 64, 67, 71 ] ], tonic: "A", mode: "natural_minor"))

    assert_equal "v", lane.slots.first.fetch("degree")
    assert_equal "tensão", lane.slots.first.fetch("tension")
    assert_match(/menor|sensível/i, lane.slots.first.fetch("explanation"))
  end

  test "mudanca de tonalidade preserva midi e sinaliza acorde fora do campo" do
    original = music([ [ 60, 64, 67 ] ])
    pitches_before = original.tracks.first.regions.first.notes.map(&:pitch)
    changed = music([ [ 60, 64, 67 ] ], tonic: "D")
    slot = Music::HarmonyLane.new(changed).slots.first

    assert_nil slot.fetch("degree")
    assert_match(/fora do tom/i, slot.fetch("explanation"))
    assert_equal pitches_before, changed.tracks.first.regions.first.notes.map(&:pitch)
    refute Music::HarmonyLane.new(changed).to_h.fetch("can_continue")
  end

  test "edicao livre preserva musica mas desabilita operacoes guiadas" do
    assert_raises(ArgumentError) { Music::HarmonyLane.new(music([ [ 60, 64, 67 ] ], instrument: "drums")) }
    [ music([ [ 60, 64, 67 ] ], offset: 120), music([ [ 60, 64, 67 ], [ 65, 69, 72 ] ], gap: true) ].each do |document|
      lane = Music::HarmonyLane.new(document)
      refute lane.guided?
      refute lane.to_h.fetch("can_append")
      assert_empty lane.slots
      assert_equal document, lane.composition
    end
    extra_space = music([ [ 60, 64, 67 ] ]).to_h
    extra_space.fetch("tracks").first.fetch("regions").first["duration_ticks"] = 960
    refute Music::HarmonyLane.new(Music::Composition.from_h(extra_space)).guided?
  end

  test "duracoes variadas e notas fora de ordem conservam projecao e recomendacao" do
    document = music([ [ 60, 64, 67 ], [ 67, 71, 74 ] ]).to_h
    region = document["tracks"][0]["regions"][0]
    region["notes"].each_with_index do |note, index|
      note["onset_tick"] = index < 3 ? 0 : 240
      note["duration_ticks"] = index < 3 ? 240 : 960
    end
    region["notes"].reverse!
    region["duration_ticks"] = 1200
    lane = Music::HarmonyLane.new(Music::Composition.from_h(document))
    assert lane.guided?
    assert_equal [ 240, 960 ], lane.slots.map { |slot| slot["duration_ticks"] }
    assert_equal 1200, lane.next_onset_tick
    assert_includes lane.to_h.fetch("recommended_indices"), 0
    assert_equal document, lane.composition.to_h
  end

  private

  # Constrói uma faixa com três eventos por tempo para testar a leitura real do MIDI.
  def music(chords, tonic: "C", mode: "major", instrument: "piano", offset: 0, gap: false)
    notes = chords.each_with_index.flat_map do |pitches, index|
      onset = (index + (gap && index.positive? ? 1 : 0)) * 480 + offset
      pitches.each_with_index.map do |pitch, voice|
        Music::NoteEvent.new(id: "n#{index}-#{voice}", pitch: pitch, onset_tick: onset,
          duration_ticks: 480, velocity: 90)
      end
    end
    region = Music::MidiRegion.new(id: "region", start_tick: 0,
      duration_ticks: [ notes.map { |note| note.onset_tick + 480 }.max || 0, 480 ].max, notes: notes)
    track = Music::Track.new(id: "harmony", name: "Harmonia", instrument_id: instrument,
      volume: 1, mute: false, solo: false, regions: [ region ])
    Music::Composition.new(id: "draft", name: "Harmonia guiada", bpm: 120,
      time_signature: { "numerator" => 4, "denominator" => 4 }, tracks: [ track ],
      context: Music::MusicalContext.new(tonic: tonic, mode: mode))
  end
end
