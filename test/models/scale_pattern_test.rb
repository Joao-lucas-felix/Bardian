require "test_helper"

# Verifica o contrato dos padrões e as notas dos padrões maior e menor natural.
class ScalePatternTest < ActiveSupport::TestCase
  # Verifica o padrão menor natural com notas naturais, bemóis e sustenidos.
  # Espera sete notas em ordem, preservando grafia e mudanças de oitava.
  test "fornece um padrao menor natural reutilizavel entre escalas" do
    pattern = ScalePattern.natural_minor

    {
      "A4" => %w[A4 B4 C5 D5 E5 F5 G5],
      "C4" => %w[C4 D4 Eb4 F4 G4 Ab4 Bb4],
      "E4" => %w[E4 F#4 G4 A4 B4 C5 D5]
    }.each do |source, expected|
      scale = Scale.new(root: Note.from_s(source), pattern: pattern)

      assert_equal expected, scale.notes.map(&:to_s), source
    end
  end

  # Verifica o padrão pronto por meio das notas que ele produz.
  # Confere sete posições, grafia e mudança de oitava em diferentes origens.
  test "fornece um padrao maior reutilizavel entre escalas" do
    pattern = ScalePattern.major

    {
      "C4" => %w[C4 D4 E4 F4 G4 A4 B4],
      "D4" => %w[D4 E4 F#4 G4 A4 B4 C#5],
      "F4" => %w[F4 G4 A4 Bb4 C5 D5 E5]
    }.each do |source, expected|
      scale = Scale.new(root: Note.from_s(source), pattern: pattern)

      assert_equal expected, scale.notes.map(&:to_s), source
    end
  end

  # Preserva os intervalos e sua ordem sem exigir sete posições.
  test "preserva a sequencia recebida" do
    unison = IntervalSpec.new(
      number: 1, quality: :perfect, direction: :ascending
    )
    second = IntervalSpec.new(
      number: 2, quality: :major, direction: :ascending
    )
    intervals = [ unison, second ]

    pattern = ScalePattern.new(intervals: intervals)

    assert_equal [ unison, second ], pattern.intervals
    refute_same intervals, pattern.intervals
  end

  # Rejeita listas vazias, tipos incorretos e listas com elementos inválidos.
  test "rejeita entradas invalidas" do
    unison = IntervalSpec.new(
      number: 1, quality: :perfect, direction: :ascending
    )

    [ nil, "major", [], [ nil ], [ unison, "segunda" ] ].each do |invalid|
      assert_raises(ArgumentError) do
        ScalePattern.new(intervals: invalid)
      end
    end
  end

  # Alterar a entrada não afeta o padrão; sua lista e atributos ficam protegidos.
  test "protege o padrao contra alteracoes" do
    unison = IntervalSpec.new(
      number: 1, quality: :perfect, direction: :ascending
    )
    intervals = [ unison ]
    pattern = ScalePattern.new(intervals: intervals)

    intervals.clear

    assert_equal [ unison ], pattern.intervals
    assert_raises(FrozenError) { pattern.intervals.clear }
    assert_raises(FrozenError) do
      pattern.instance_variable_set(:@intervals, [])
    end
  end
end
