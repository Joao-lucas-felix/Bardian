require "test_helper"

# Verifica a construção de acordes e a proteção de seus atributos.
class ChordTest < ActiveSupport::TestCase
  # Confere tríades em posição fundamental, incluindo acidentes e oitavas.
  # C# maior deve preservar E#, mesmo que F tenha a mesma altura.
  test "constroi triades preservando a grafia" do
    [
      [ "C4", :major, %w[C4 E4 G4] ],
      [ "C#4", :major, %w[C#4 E#4 G#4] ],
      [ "B4", :major, %w[B4 D#5 F#5] ],
      [ "C4", :minor, %w[C4 Eb4 G4] ],
      [ "A4", :minor, %w[A4 C5 E5] ]
    ].each do |source, third_quality, expected|
      chord = Chord.new(
        root: Note.from_s(source),
        pattern: triad_pattern(third_quality)
      )

      assert_equal expected, chord.notes.map(&:to_s), source
    end
  end

  # Exige objetos do domínio e rejeita um padrão de escala como padrão de acorde.
  test "rejeita entradas de tipos invalidos" do
    root = Note.from_s("C4")
    pattern = triad_pattern(:major)

    [ nil, "C4", 48 ].each do |invalid|
      assert_raises(ArgumentError) do
        Chord.new(root: invalid, pattern: pattern)
      end
    end

    [ nil, "major", [], ScalePattern.major ].each do |invalid|
      assert_raises(ArgumentError) do
        Chord.new(root: root, pattern: invalid)
      end
    end
  end

  # A terça maior de D##4 exigiria F triplo sustenido.
  # A construção deve falhar sem substituir a grafia por uma equivalente.
  test "rejeita acorde que exige acidente triplo" do
    assert_raises(ArgumentError) do
      Chord.new(
        root: Note.from_s("D##4"),
        pattern: triad_pattern(:major)
      )
    end
  end

  # Mantém as entradas intactas e impede alterações posteriores no acorde.
  test "preserva as entradas e protege as notas" do
    root = Note.from_s("C4")
    pattern = triad_pattern(:major)
    original_intervals = pattern.intervals.dup

    chord = Chord.new(root: root, pattern: pattern)

    assert_same root, chord.root
    assert_same pattern, chord.pattern
    assert_equal "C4", root.to_s
    assert_equal original_intervals, pattern.intervals
    assert chord.notes.all?(&:frozen?)
    assert_raises(FrozenError) { chord.notes.clear }
    assert_raises(FrozenError) do
      chord.instance_variable_set(:@root, Note.from_s("D4"))
    end
  end

  private

  # Monta um padrão de tríade para os testes.
  # third_quality: :major ou :minor, determinando a qualidade da terça.
  # Retorna ChordPattern com uníssono justo, terça e quinta justa ascendentes.
  def triad_pattern(third_quality)
    intervals = [
      [ 1, :perfect ],
      [ 3, third_quality ],
      [ 5, :perfect ]
    ].map do |number, quality|
      IntervalSpec.new(
        number: number,
        quality: quality,
        direction: :ascending
      )
    end

    ChordPattern.new(intervals: intervals)
  end
end
