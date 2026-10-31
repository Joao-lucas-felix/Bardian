require "test_helper"

# Protege a declaração independente de eventos MIDI e a compatibilidade do JSON.
class MusicHarmonyBlockTest < ActiveSupport::TestCase
  # Documento mínimo permite observar exclusivamente o contrato novo.
  def source
    { "version" => 1, "id" => "song", "name" => "Teste", "bpm" => 120,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "tracks" => [],
      "harmony" => { "blocks" => [ { "id" => "block", "onset_tick" => 0,
        "duration_ticks" => 960, "chord" => { "root" => "Db", "quality" => "major" } } ] } }
  end

  # Perder o campo na serialização tornaria a edição livre novamente inferida.
  test "preserva declaracao ausencia e vazio separadamente" do
    assert_equal source, Music::Composition.from_h(source).to_h
    empty = source.merge("harmony" => { "blocks" => [] })
    assert_equal empty, Music::Composition.from_h(empty).to_h
    old = source.except("harmony")
    assert_equal old, Music::Composition.from_h(old).to_h
  end

  # O servidor recusa conteúdo estruturalmente inválido sem normalização silenciosa.
  test "rejeita declaracoes invalidas e colisoes globais" do
    [ nil, {}, { "blocks" => nil } ].each do |invalid|
      assert_raises(ArgumentError) { Music::Composition.from_h(source.merge("harmony" => invalid)) }
    end
    [ { "id" => "song" }, { "onset_tick" => 1 }, { "onset_tick" => "0" },
     { "duration_ticks" => 481 }, { "chord" => { "root" => "C4", "quality" => "major" } },
     { "chord" => { "root" => "C", "quality" => "augmented" } } ].each do |change|
      data = source
      data["harmony"]["blocks"][0].merge!(change)
      assert_raises(ArgumentError) { Music::Composition.from_h(data) }
    end
    data = source
    data["harmony"]["blocks"] = 33.times.map { |i| source["harmony"]["blocks"][0].merge("id" => "b#{i}", "onset_tick" => i * 960) }
    assert_raises(ArgumentError) { Music::Composition.from_h(data) }
  end
end
