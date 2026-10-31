require "test_helper"

# Protege as tríades e os rótulos didáticos derivados de uma tonalidade declarada.
class MusicHarmonicFieldTest < ActiveSupport::TestCase
  test "constroi campo maior com graus notas e funcoes" do
    field = Music::HarmonicField.new(Music::MusicalContext.new(tonic: "C", mode: "major"))
    assert_equal %w[I ii iii IV V vi vii°], field.degrees.map(&:numeral)
    assert_equal %w[C Dm Em F G Am B°], field.degrees.map(&:symbol)
    assert_equal [ "B", "D", "F" ], field.degrees.last.note_names
    assert_equal %w[tonic predominant dominant], [ field.degrees[0], field.degrees[1], field.degrees[4] ].map(&:function)
  end

  test "menor natural preserva v menor e ii diminuto" do
    field = Music::HarmonicField.new(Music::MusicalContext.new(tonic: "A", mode: "natural_minor"))
    assert_equal %w[i ii° III iv v VI VII], field.degrees.map(&:numeral)
    assert_equal [ "Am", "B°", "C", "Dm", "Em", "F", "G" ], field.degrees.map(&:symbol)
    assert_equal [ "E", "G", "B" ], field.degrees[4].note_names
  end

  test "valida contexto completo sem aceitar modo ou tonalidade indevidos" do
    assert_equal({ "tonic" => "Bb", "mode" => "major" }, Music::MusicalContext.from_h({ "tonic" => "Bb", "mode" => "major" }).to_h)
    assert_raises(ArgumentError) { Music::MusicalContext.from_h({ "tonic" => "C", "mode" => "dorian" }) }
    assert_raises(ArgumentError) { Music::MusicalContext.from_h({ "tonic" => "H", "mode" => "major" }) }
    assert_raises(ArgumentError) { Music::MusicalContext.from_h({ "tonic" => "C" }) }
  end

  # Cada opção oferecida no formulário precisa produzir sete tríades utilizáveis.
  test "todas as tonalidades oferecidas constroem os dois campos" do
    Music::MusicalContext::TONICS.product(Music::MusicalContext::MODES).each do |tonic, mode|
      field = Music::HarmonicField.new(Music::MusicalContext.new(tonic: tonic, mode: mode))
      assert_equal 7, field.degrees.length, "#{tonic} #{mode}"
      assert field.degrees.all? { |degree| degree.note_names.length == 3 }, "#{tonic} #{mode}"
    end
  end
end
