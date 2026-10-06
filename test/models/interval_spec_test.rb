require "test_helper"

# Verifica descrições independentes de notas, suas combinações e imutabilidade.
class IntervalSpecTest < ActiveSupport::TestCase
  # Integra descrição, transposição e análise de uma terça maior ascendente.
  # Partindo de C#4, espera E#4 e confirma número, qualidade e deslocamentos.
  # A grafia importa: F4 tem a mesma altura, mas outra relação diatônica.
  test "analisa o intervalo produzido pela aplicacao de uma descricao" do
    origin = Note.from_s("C#4")
    spec = IntervalSpec.new(
      number: 3, quality: :major, direction: :ascending
    )

    destination = spec.apply_to(origin)
    interval = Interval.new(from: origin, to: destination)

    assert_equal Note.from_s("E#4"), destination
    assert_equal 3, interval.number
    assert_equal :major, interval.quality
    assert_equal 2, interval.diatonic_steps
    assert_equal 4, interval.semitones
  end

  # A mesma descrição pode ser aplicada a várias notas, preservando a grafia.
  test "aplica uma terca maior sem modificar a origem" do
    spec = IntervalSpec.new(
      number: 3, quality: :major, direction: :ascending
    )

    { "C4" => "E4", "C#4" => "E#4" }.each do |source, expected|
      original = Note.from_s(source)
      result = spec.apply_to(original)

      assert_equal Note.from_s(expected), result
      assert_equal source, original.to_s
      refute_same original, result
      assert result.frozen?
    end
  end

  # Verifica a aplicação da direção descendente através de uma mudança de oitava.
  test "aplica uma terca maior descendente" do
    spec = IntervalSpec.new(
      number: 3, quality: :major, direction: :descending
    )

    assert_equal Note.from_s("Ab3"), spec.apply_to(Note.from_s("C4"))
  end

  # Não interpreta textos ou outros tipos implicitamente.
  test "rejeita origens que nao sejam notas" do
    spec = IntervalSpec.new(
      number: 3, quality: :major, direction: :ascending
    )

    [ nil, "C4", 48 ].each do |invalid|
      assert_raises(ArgumentError) { spec.apply_to(invalid) }
    end
  end

  # Propaga o limite de acidentes sem substituir a grafia solicitada.
  test "rejeita resultado que exige acidente triplo" do
    spec = IntervalSpec.new(
      number: 5, quality: :augmented, direction: :ascending
    )

    assert_raises(ArgumentError) do
      spec.apply_to(Note.from_s("C##4"))
    end
  end

  # Verifica os deslocamentos escritos e cromáticos, incluindo compostos,
  # alterações múltiplas e movimento sonoro contrário à direção escrita.
  test "converte descricoes em passos diatonicos e semitons" do
    [
      [ 3, :major, :ascending, 1, 2, 4 ],
      [ 3, :minor, :descending, 1, -2, -3 ],
      [ 5, :perfect, :ascending, 1, 4, 7 ],
      [ 5, :augmented, :ascending, 2, 4, 9 ],
      [ 3, :diminished, :ascending, 1, 2, 2 ],
      [ 2, :diminished, :ascending, 2, 1, -1 ],
      [ 9, :major, :ascending, 1, 8, 14 ],
      [ 8, :diminished, :descending, 1, -7, -11 ],
      [ 1, :augmented, :descending, 1, 0, -1 ],
      [ 1, :perfect, :ascending, 1, 0, 0 ]
    ].each do |number, quality, direction, multiplicity, steps, semitones|
      spec = IntervalSpec.new(
        number: number, quality: quality,
        direction: direction, multiplicity: multiplicity
      )

      assert_equal steps, spec.diatonic_steps
      assert_equal semitones, spec.semitones
    end
  end

  # Confirma que a descrição musical fornece os deslocamentos necessários
  # à transposição, preservando inclusive a grafia de notas alteradas.
  test "calcula a terca maior ascendente de uma nota" do
    spec = IntervalSpec.new(
      number: 3,
      quality: :major,
      direction: :ascending
    )

    { "C4" => "E4", "C#4" => "E#4" }.each do |source, expected|
      result = Note.from_s(source).transpose(
        diatonic_steps: spec.diatonic_steps,
        semitones: spec.semitones
      )

      assert_equal Note.from_s(expected), result
    end
  end

  # Preserva os atributos musicais, inclusive compostos e alterações múltiplas.
  test "aceita descricoes validas de intervalos" do
    [
      [ 3, :major, :ascending, 1 ],
      [ 3, :minor, :descending, 1 ],
      [ 5, :perfect, :ascending, 1 ],
      [ 9, :major, :ascending, 1 ],
      [ 8, :diminished, :descending, 1 ],
      [ 5, :augmented, :ascending, 2 ],
      [ 3, :diminished, :descending, 3 ],
      [ 1, :augmented, :ascending, 1 ],
      [ 1, :augmented, :descending, 1 ]
    ].each do |number, quality, direction, multiplicity|
      spec = IntervalSpec.new(
        number: number, quality: quality,
        direction: direction, multiplicity: multiplicity
      )

      assert_equal [ number, quality, direction, multiplicity ],
        [ spec.number, spec.quality, spec.direction, spec.multiplicity ]
    end
  end

  # Uma descrição sem multiplicidade explícita representa uma alteração simples.
  test "usa multiplicidade um por padrao" do
    spec = IntervalSpec.new(number: 5, quality: :augmented, direction: :ascending)

    assert_equal 1, spec.multiplicity
  end

  # A qualidade deve respeitar a família diatônica, inclusive nos compostos.
  test "rejeita qualidades incompativeis com o numero" do
    [ [ 3, :perfect ], [ 5, :major ], [ 8, :minor ], [ 9, :perfect ] ].each do |number, quality|
      assert_raises(ArgumentError) do
        IntervalSpec.new(number: number, quality: quality, direction: :ascending)
      end
    end
  end

  # Não converte tipos e não aceita números ou multiplicidades não positivos.
  test "rejeita numeros e multiplicidades invalidos" do
    [ nil, "2", 2.0, 0, -1, true ].each do |invalid|
      assert_raises(ArgumentError) do
        IntervalSpec.new(number: invalid, quality: :augmented, direction: :ascending)
      end

      assert_raises(ArgumentError) do
        IntervalSpec.new(number: 5, quality: :augmented,
          direction: :ascending, multiplicity: invalid)
      end
    end
  end

  # Símbolos conhecidos evitam interpretações implícitas de textos ou valores ausentes.
  test "rejeita direcoes e qualidades desconhecidas" do
    [ nil, "ascending", :up, 1 ].each do |direction|
      assert_raises(ArgumentError) do
        IntervalSpec.new(number: 3, quality: :major, direction: direction)
      end
    end

    [ nil, "major", :unknown, 1 ].each do |quality|
      assert_raises(ArgumentError) do
        IntervalSpec.new(number: 3, quality: quality, direction: :ascending)
      end
    end
  end

  # Apenas aumentado e diminuto admitem multiplicidade maior que um.
  test "rejeita multiplicidade para maior menor e justo" do
    [ [ 3, :major ], [ 3, :minor ], [ 5, :perfect ] ].each do |number, quality|
      assert_raises(ArgumentError) do
        IntervalSpec.new(number: number, quality: quality,
          direction: :ascending, multiplicity: 2)
      end
    end
  end

  # A convenção de uníssono usa distância absoluta nas duas direções.
  test "rejeita unissono diminuto" do
    [ :ascending, :descending ].each do |direction|
      assert_raises(ArgumentError) do
        IntervalSpec.new(number: 1, quality: :diminished, direction: direction)
      end
    end
  end

  # O congelamento impede mudanças posteriores que contornem as validações.
  test "impede reatribuicao dos atributos" do
    spec = IntervalSpec.new(number: 3, quality: :major, direction: :ascending)

    assert spec.frozen?
    { :@number => 0, :@quality => :perfect,
      :@direction => :up, :@multiplicity => 0 }.each do |attribute, value|
      assert_raises(FrozenError) { spec.instance_variable_set(attribute, value) }
    end
    assert_equal [ 3, :major, :ascending, 1 ],
      [ spec.number, spec.quality, spec.direction, spec.multiplicity ]
  end
end
