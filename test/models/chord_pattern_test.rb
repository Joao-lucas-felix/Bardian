require "test_helper"

# Verifica o contrato dos padrões e as notas das tríades maior e menor.
class ChordPatternTest < ActiveSupport::TestCase
  # Confere o padrão maior por suas notas, incluindo grafia e mudança de oitava.
  # C# maior exige E#, preservando a relação de terça com a fundamental.
  test "fornece um padrao de triade maior reutilizavel" do
    pattern = ChordPattern.major_triad

    {
      "C4" => %w[C4 E4 G4],
      "C#4" => %w[C#4 E#4 G#4],
      "B4" => %w[B4 D#5 F#5]
    }.each do |source, expected|
      chord = Chord.new(root: Note.from_s(source), pattern: pattern)

      assert_equal expected, chord.notes.map(&:to_s), source
    end
  end

  # Confere o padrão menor com notas naturais, bemóis e sustenidos.
  # A mesma descrição deve funcionar com diferentes fundamentais.
  test "fornece um padrao de triade menor reutilizavel" do
    pattern = ChordPattern.minor_triad

    {
      "C4" => %w[C4 Eb4 G4],
      "A4" => %w[A4 C5 E5],
      "F#4" => %w[F#4 A4 C#5]
    }.each do |source, expected|
      chord = Chord.new(root: Note.from_s(source), pattern: pattern)

      assert_equal expected, chord.notes.map(&:to_s), source
    end
  end

  # Preserva os intervalos de uma tríade e a ordem fornecida.
  test "preserva a sequencia recebida" do
    intervals = major_triad_intervals

    pattern = ChordPattern.new(intervals: intervals)

    assert_equal intervals, pattern.intervals
    refute_same intervals, pattern.intervals
    assert_equal [ 1, 3, 5 ], pattern.intervals.map(&:number)
  end

  # Rejeita listas vazias, tipos incorretos e elementos que não sejam intervalos.
  test "rejeita entradas invalidas" do
    unison = major_triad_intervals.first

    [ nil, "major", [], [ nil ], [ unison, "terca" ] ].each do |invalid|
      assert_raises(ArgumentError) do
        ChordPattern.new(intervals: invalid)
      end
    end
  end

  # Alterações na entrada não afetam o padrão; lista e atributos são protegidos.
  test "protege o padrao contra alteracoes" do
    intervals = major_triad_intervals
    expected = intervals.dup
    pattern = ChordPattern.new(intervals: intervals)

    intervals.clear

    assert_equal expected, pattern.intervals
    assert_raises(FrozenError) { pattern.intervals.clear }
    assert_raises(FrozenError) do
      pattern.instance_variable_set(:@intervals, [])
    end
  end

  private

  # Retorna os intervalos ascendentes de uma tríade maior para os testes.
  # Todos são relativos à fundamental: uníssono, terça e quinta.
  def major_triad_intervals
    [
      [ 1, :perfect ],
      [ 3, :major ],
      [ 5, :perfect ]
    ].map do |number, quality|
      IntervalSpec.new(
        number: number,
        quality: quality,
        direction: :ascending
      )
    end
  end
end
