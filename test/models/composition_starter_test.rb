require "test_helper"

# Confere que a proposta ouvida e a faixa salva usam o mesmo domínio musical.
class CompositionStarterTest < ActiveSupport::TestCase
  # Uma mudança de tonalidade precisa produzir acordes do novo campo harmônico.
  test "gera propostas a partir da tonalidade declarada sem salvar notas" do
    starter = CompositionStarter.new(id: "ideia", name: "Ideia", bpm: 90,
      tonic: "D", mode: "major", instrument: "synth", random: Random.new(1))

    previews = starter.preview(count: 3)

    assert_equal 3, previews.length
    assert previews.all? { |sequence| sequence.length == 4 && sequence.first.fetch("symbol") == "D" }
    assert_equal [], starter.document.fetch("tracks").first.fetch("regions").first.fetch("notes")
  end

  # A seleção grava exatamente as alturas que a pessoa pôde ouvir na proposta.
  test "reconstroi os quatro graus selecionados como notas MIDI" do
    starter = CompositionStarter.new(id: "ideia", name: "Ideia", bpm: 90,
      tonic: "C", mode: "major", instrument: "fluid_piano")

    document = starter.document(degrees: "0,3,4,0")
    notes = document.fetch("tracks").first.fetch("regions").first.fetch("notes")

    assert_equal 90, document.fetch("bpm")
    assert_equal({ "tonic" => "C", "mode" => "major" }, document.fetch("context"))
    assert_equal "fluid_piano", document.fetch("tracks").first.fetch("instrument_id")
    assert_equal [ 60, 64, 67 ], notes.first(3).map { |note| note.fetch("pitch") }
    assert_equal [ 0, 480, 960, 1440 ], notes.map { |note| note.fetch("onset_tick") }.uniq
    assert_equal 12, notes.length
    assert_equal 1920, document.fetch("tracks").first.fetch("regions").first.fetch("duration_ticks")
    assert_equal 4, document.dig("harmony", "blocks")&.length
    assert_equal "not_needed", Music::HarmonyRecovery.new(Music::Composition.from_h(document)).to_h.fetch("status")
  end

  # Não aceita grau forjado ou timbre fora dos presets disponíveis.
  test "rejeita configuracoes e selecao invalidas" do
    assert_raises(ArgumentError) do
      CompositionStarter.new(id: "ideia", name: "Ideia", bpm: 241,
        tonic: "C", mode: "major", instrument: "synth")
    end
    assert_raises(ArgumentError) do
      CompositionStarter.new(id: "ideia", name: "Ideia", bpm: 90,
        tonic: "C", mode: "major", instrument: "drums")
    end
    starter = CompositionStarter.new(id: "ideia", name: "Ideia", bpm: 90,
      tonic: "C", mode: "major", instrument: "synth")
    assert_raises(ArgumentError) { starter.document(degrees: "0,3,7,0") }
    assert_raises(ArgumentError) { starter.document(degrees: "1,3,4,0") }
  end
end
