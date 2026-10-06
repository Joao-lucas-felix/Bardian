require "test_helper"

# Verifica a relação ordenada entre notas, preservando escrita e altura.
class IntervalTest < ActiveSupport::TestCase
  # Verifica as cinco categorias nas duas famílias e em ambas as direções.
  # Inclui compostos, alterações múltiplas e notas de mesma altura.
  test "classifica a qualidade do intervalo" do
    [
      [ "C4", "C4", :perfect ],
      [ "C4", "F4", :perfect ],
      [ "C4", "G4", :perfect ],
      [ "C4", "C5", :perfect ],
      [ "C4", "D4", :major ],
      [ "C4", "E4", :major ],
      [ "C4", "A4", :major ],
      [ "C4", "B4", :major ],
      [ "C4", "Eb4", :minor ],
      [ "C4", "Ebb4", :diminished ],
      [ "C4", "Gb4", :diminished ],
      [ "C4", "Gbb4", :diminished ],
      [ "C4", "G#4", :augmented ],
      [ "C4", "G##4", :augmented ],
      [ "C4", "E#4", :augmented ],
      [ "C4", "D5", :major ],
      [ "C4", "Eb5", :minor ],
      [ "C4", "C#4", :augmented ],
      [ "C#4", "Db4", :diminished ],
      [ "C##4", "Db4", :diminished ]
    ].each do |first, second, expected_quality|
      [ [ first, second ], [ second, first ] ].each do |from, to|
        interval = Interval.new(
          from: Note.from_s(from),
          to: Note.from_s(to)
        )

        assert_equal expected_quality, interval.quality,
          "#{from} -> #{to}"
      end
    end
  end

  # Verifica referências, contrações, expansões e intervalos compostos.
  # Repetir cada caso na ordem inversa verifica a normalização da direção.
  test "calcula o desvio em relacao ao intervalo maior ou justo" do
    [
      [ "C4", "C4", 0 ],
      [ "C4", "D4", 0 ],
      [ "C4", "E4", 0 ],
      [ "C4", "F4", 0 ],
      [ "C4", "G4", 0 ],
      [ "C4", "A4", 0 ],
      [ "C4", "B4", 0 ],
      [ "C4", "C5", 0 ],
      [ "C4", "Eb4", -1 ],
      [ "C4", "Ebb4", -2 ],
      [ "C4", "Gb4", -1 ],
      [ "C4", "G#4", 1 ],
      [ "C4", "G##4", 2 ],
      [ "C4", "D5", 0 ],
      [ "C4", "Eb5", -1 ],
      [ "C4", "C6", 0 ],
      [ "C4", "C#4", 1 ],
      [ "C4", "Cbb4", 2 ],
      [ "C#4", "Db4", -2 ],
      [ "C##4", "Db4", -3 ]
    ].each do |first, second, expected_offset|
      [ [ first, second ], [ second, first ] ].each do |from, to|
        interval = Interval.new(
          from: Note.from_s(from),
          to: Note.from_s(to)
        )

        assert_equal expected_offset, interval.quality_offset,
          "#{from} -> #{to}"
      end
    end
  end

  # Verifica a contagem inclusiva, independentemente da direção e dos acidentes.
  # Inclui intervalos compostos para garantir que não sejam reduzidos à oitava.
  test "identifica o numero do intervalo pela escrita das notas" do
    [
      [ "C4", "C4", 1 ],
      [ "C4", "C#4", 1 ],
      [ "C#4", "Db4", 2 ],
      [ "B4", "C5", 2 ],
      [ "C4", "E4", 3 ],
      [ "E4", "C4", 3 ],
      [ "C4", "G4", 5 ],
      [ "C4", "C5", 8 ],
      [ "C4", "D5", 9 ],
      [ "D5", "C4", 9 ]
    ].each do |from, to, expected_number|
      interval = Interval.new(
        from: Note.from_s(from),
        to: Note.from_s(to)
      )

      assert_equal expected_number, interval.number, "#{from} -> #{to}"
    end
  end

  # Valores esperados distinguem passos entre letras de distâncias em semitons.
  test "calcula deslocamentos diatonicos e cromaticos" do
    [
      [ "C4", "E4", 2, 4 ],
      [ "E4", "C4", -2, -4 ],
      [ "C4", "C5", 7, 12 ],
      [ "C4", "C4", 0, 0 ],
      [ "C4", "C#4", 0, 1 ],
      [ "C#4", "Db4", 1, 0 ],
      [ "B4", "C5", 1, 1 ],
      [ "C5", "B4", -1, -1 ],
      [ "B#4", "C5", 1, 0 ],
      [ "B-1", "C0", 1, 1 ],
      [ "C4", "D5", 8, 14 ]
    ].each do |from, to, steps, semitones|
      interval = Interval.new(from: Note.from_s(from), to: Note.from_s(to))

      assert_equal steps, interval.diatonic_steps, "#{from} -> #{to}"
      assert_equal semitones, interval.semitones, "#{from} -> #{to}"
    end
  end

  # Trocar origem e destino deve inverter os sinais, sem perder a grafia.
  test "inverte os deslocamentos ao trocar a ordem das notas" do
    [ [ "C4", "E4" ], [ "B4", "C5" ], [ "C#4", "Db4" ], [ "C4", "C#4" ] ].each do |first, second|
      from = Note.from_s(first)
      to = Note.from_s(second)
      forward = Interval.new(from: from, to: to)
      backward = Interval.new(from: to, to: from)

      assert_equal(-forward.diatonic_steps, backward.diatonic_steps)
      assert_equal(-forward.semitones, backward.semitones)
    end
  end

  # O construtor exige notas já validadas, sem interpretar strings implicitamente.
  test "rejeita origem ou destino que nao sejam notas" do
    note = Note.from_s("C4")

    [ nil, "C4", 4 ].each do |invalid|
      assert_raises(ArgumentError) { Interval.new(from: invalid, to: note) }
      assert_raises(ArgumentError) { Interval.new(from: note, to: invalid) }
    end
  end
end
