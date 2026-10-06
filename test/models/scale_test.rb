require "test_helper"

# Verifica a construção das notas e a proteção do estado da escala.
class ScaleTest < ActiveSupport::TestCase
  # Confere sete notas, acidentes e mudança de oitava, sem repetir a origem.
  test "constroi escalas maiores preservando a grafia" do
    pattern = major_pattern

    {
      "C4" => %w[C4 D4 E4 F4 G4 A4 B4],
      "D4" => %w[D4 E4 F#4 G4 A4 B4 C#5],
      "F4" => %w[F4 G4 A4 Bb4 C5 D5 E5]
    }.each do |source, expected|
      scale = Scale.new(root: Note.from_s(source), pattern: pattern)

      assert_equal expected, scale.notes.map(&:to_s), source
    end
  end

  # As entradas devem ser objetos do domínio, sem conversão implícita.
  test "rejeita entradas de tipos invalidos" do
    root = Note.from_s("C4")
    pattern = major_pattern

    [ nil, "C4", 48 ].each do |invalid|
      assert_raises(ArgumentError) do
        Scale.new(root: invalid, pattern: pattern)
      end
    end

    [ nil, "major", [] ].each do |invalid|
      assert_raises(ArgumentError) do
        Scale.new(root: root, pattern: invalid)
      end
    end
  end

  # Em D## maior, a terça exigiria F triplo sustenido, fora do limite atual.
  # O erro deve ocorrer na construção, sem substituir a grafia solicitada.
  test "rejeita escala que exige acidente triplo" do
    assert_raises(ArgumentError) do
      Scale.new(root: Note.from_s("D##4"), pattern: major_pattern)
    end
  end

  # Preserva as entradas e impede alterações na lista ou nos atributos.
  test "preserva as entradas e protege as notas" do
    root = Note.from_s("C4")
    pattern = major_pattern
    original_intervals = pattern.intervals.dup

    scale = Scale.new(root: root, pattern: pattern)

    assert_same root, scale.root
    assert_same pattern, scale.pattern
    assert_equal "C4", root.to_s
    assert_equal original_intervals, pattern.intervals
    assert scale.notes.all?(&:frozen?)
    assert_raises(FrozenError) { scale.notes.clear }
    assert_raises(FrozenError) do
      scale.instance_variable_set(:@root, Note.from_s("D4"))
    end
  end

  private

  # Retorna um padrão maior com sete intervalos ascendentes desde a origem.
  # É uma preparação dos testes; não adiciona um catálogo ao domínio.
  def major_pattern
    qualities = [
      :perfect, :major, :major, :perfect, :perfect, :major, :major
    ]

    intervals = qualities.each_with_index.map do |quality, index|
      IntervalSpec.new(
        number: index + 1,
        quality: quality,
        direction: :ascending
      )
    end

    ScalePattern.new(intervals: intervals)
  end
end
