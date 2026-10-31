require "test_helper"
require "set"

# Verifica validações, proteção dos atributos, conversão textual e igualdade das notas.
class NoteTest < ActiveSupport::TestCase
  # Verifica grafia, altura, mudanças de oitava e preservação da origem.
  # Mesmo o deslocamento zero deve retornar uma nova instância.
  test "transpoe notas preservando a escrita solicitada" do
    [
      [ "C4", 2, 4, "E4" ],
      [ "C#4", 2, 4, "E#4" ],
      [ "E4", -2, -4, "C4" ],
      [ "B4", 1, 1, "C5" ],
      [ "C0", -1, -1, "B-1" ],
      [ "C4", 8, 14, "D5" ],
      [ "C4", 0, 1, "C#4" ],
      [ "C#4", 1, 0, "Db4" ],
      [ "C##4", 1, -1, "Db4" ],
      [ "C4", 4, 9, "G##4" ],
      [ "C4", 4, 5, "Gbb4" ],
      [ "C4", 0, 0, "C4" ]
    ].each do |source, steps, semitones, expected|
      original = Note.from_s(source)
      result = original.transpose(
        diatonic_steps: steps,
        semitones: semitones
      )

      assert_equal Note.from_s(expected), result
      assert_equal source, original.to_s
      refute_same original, result
      assert result.frozen?
    end
  end

  # Impede conversões implícitas que poderiam esconder entradas incorretas.
  test "rejeita deslocamentos que nao sejam inteiros" do
    note = Note.from_s("C4")

    [ nil, "2", 2.0, true ].each do |invalid|
      assert_raises(ArgumentError) do
        note.transpose(diatonic_steps: invalid, semitones: 4)
      end

      assert_raises(ArgumentError) do
        note.transpose(diatonic_steps: 2, semitones: invalid)
      end
    end
  end

  # Mantém o limite de acidentes sem trocar a letra para acomodar a altura.
  test "rejeita transposicoes que exigem acidentes alem dos limites" do
    note = Note.from_s("C4")

    [ -3, 3 ].each do |semitones|
      assert_raises(ArgumentError) do
        note.transpose(diatonic_steps: 0, semitones: semitones)
      end
    end

    assert_equal "C4", note.to_s
  end

  # As sete letras naturais devem ser aceitas diretamente pelo construtor.
  test "aceita as sete letras naturais" do
    %w[A B C D E F G].each do |letter|
      assert_equal letter, Note.new(letter: letter, accidental: 0, octave: 4).letter
    end
  end

  # A validação deve funcionar mesmo quando a entrada não passa por from_s.
  test "rejeita letras invalidas no construtor" do
    [ "H", "c", "", nil, :C, 4 ].each do |letter|
      assert_raises(ArgumentError) do
        Note.new(letter: letter, accidental: 0, octave: 4)
      end
    end
  end

  # Protege as regras compartilhadas; restaura o conteúdo caso a proteção falhe.
  test "impede modificar strings das constantes" do
    (Note::VALID_LETTERS + Note::ACCIDENTAL_SYMBOLS.values).each do |value|
      original = value.dup
      begin
        assert_raises(FrozenError) { value.replace("?") }
      ensure
        value.replace(original) unless value.frozen?
      end
    end
  end

  # O congelamento da instância impede contornar as validações por reatribuição.
  test "impede reatribuir atributos internos" do
    note = Note.from_s("C4")

    { :@letter => "H", :@accidental => 3, :@octave => nil }.each do |attribute, value|
      assert_raises(FrozenError) { note.instance_variable_set(attribute, value) }
    end
    assert_equal "C4", note.to_s
  end

  # Uma chave deve ser recuperada por outra instância com o mesmo valor musical.
  test "recupera valores de hash com notas iguais" do
    notes = { Note.from_s("C#4") => "do sustenido" }

    assert_equal "do sustenido", notes[Note.from_s("C#4")]
    assert_nil notes[Note.from_s("Db4")]
  end

  # Coleções eliminam duplicatas por escrita, preservando grafias enarmônicas.
  test "agrupa notas iguais em set sem agrupar grafias diferentes" do
    notes = Set.new([ Note.from_s("C#4"), Note.from_s("C#4"), Note.from_s("Db4") ])

    assert_equal 2, notes.size
    assert notes.include?(Note.from_s("C#4"))
    assert notes.include?(Note.from_s("Db4"))
  end

  # A escrita da oitava é canônica: zero não recebe sinal nem zeros iniciais.
  test "rejeita oitavas com zero negativo ou zeros iniciais" do
    [ "C-0", "C04", "C-04" ].each do |text|
      assert_raises(ArgumentError) { Note.from_s(text) }
    end
    assert_equal "C0", Note.from_s("C0").to_s
    assert_equal "C-1", Note.from_s("C-1").to_s
  end

  # Instâncias com a mesma escrita e oitava representam a mesma altura.
  test "reconhece a mesma altura em notas com os mesmos atributos" do
    assert Note.from_s("C4").same_pitch?(Note.from_s("C4"))
  end

  # Grafias diferentes podem indicar a mesma altura, inclusive cruzando oitavas.
  test "reconhece a mesma altura em grafias diferentes" do
    [ [ "C#4", "Db4" ], [ "B#4", "C5" ], [ "Cb4", "B3" ], [ "C##4", "D4" ] ].each do |first, second|
      assert Note.from_s(first).same_pitch?(Note.from_s(second))
      assert Note.from_s(second).same_pitch?(Note.from_s(first))
    end
  end

  # A comparação considera a altura completa, sem descartar a oitava.
  test "distingue alturas diferentes" do
    note = Note.from_s("C4")

    [ "C#4", "C5", "B3" ].each do |text|
      refute note.same_pitch?(Note.from_s(text))
    end
  end

  # Outros tipos não representam notas para esta comparação e retornam false.
  test "nao compara altura com objetos de outros tipos" do
    note = Note.from_s("C4")

    [ nil, "C4", 48 ].each do |other|
      assert_equal false, note.same_pitch?(other)
    end
  end

  # Verifica a referência, as letras naturais, os acidentes e as mudanças de oitava.
  test "calcula a posicao cromatica a partir de C0" do
    {
      "C0" => 0,
      "D0" => 2,
      "E0" => 4,
      "F0" => 5,
      "G0" => 7,
      "A0" => 9,
      "B0" => 11,
      "C4" => 48,
      "C#4" => 49,
      "Db4" => 49,
      "B#4" => 60,
      "C5" => 60,
      "Cb0" => -1,
      "C-1" => -12,
      "Cbb4" => 46,
      "C##4" => 50
    }.each do |text, expected|
      assert_equal expected, Note.from_s(text).chromatic_position, text
    end
  end

  # Objetos distintos devem ser iguais quando representam a mesma escrita e oitava.
  test "considera iguais notas com os mesmos atributos" do
    assert_equal Note.from_s("C#4"), Note.from_s("C#4")
  end

  # Cada atributo participa da igualdade; equivalência sonora não basta.
  test "distingue notas com atributos diferentes" do
    note = Note.from_s("C#4")

    [ "D#4", "C4", "C#5", "Db4" ].each do |text|
      refute_equal note, Note.from_s(text)
    end
  end

  # A comparação com outros tipos deve retornar false, sem levantar erro.
  test "nao considera uma nota igual a objetos de outros tipos" do
    note = Note.from_s("C4")

    [ nil, "C4", 4 ].each do |other|
      refute_equal note, other
    end
  end

  # Alterações na string original não devem modificar uma nota já validada.
  test "preserva a letra quando a entrada original e modificada" do
    letter = "C".dup
    note = Note.new(letter: letter, accidental: 0, octave: 4)

    letter.replace("H")

    assert_equal "C4", note.to_s
  end

  # O leitor não deve permitir alterar a string interna e contornar a validação.
  test "impede modificar a letra retornada pelo leitor" do
    note = Note.new(letter: "C", accidental: 0, octave: 4)

    assert_raises(FrozenError) do
      note.letter.replace("H")
    end

    assert_equal "C4", note.to_s
  end

  # Extrai os atributos sem perder a escrita de acidentes simples ou duplos.
  test "interpreta notas a partir de strings" do
    {
      "C4" => [ "C", 0, 4 ],
      "Db4" => [ "D", -1, 4 ],
      "Ebb0" => [ "E", -2, 0 ],
      "F#10" => [ "F", 1, 10 ],
      "G##-1" => [ "G", 2, -1 ]
    }.each do |text, expected|
      note = Note.from_s(text)

      assert_instance_of Note, note
      assert_equal expected, [ note.letter, note.accidental, note.octave ]
    end
  end

  # O formato estrito não normaliza espaços, minúsculas ou símbolos Unicode.
  test "rejeita strings fora do formato de nota" do
    [ "H4", "C###4", "C", "c4", " C4", "C4 ", "C4\n",
     "C♯4", "C4.5", "C+4", "C04", "C#b4", "" ].each do |text|
      assert_raises(ArgumentError, "deveria rejeitar #{text.inspect}") do
        Note.from_s(text)
      end
    end
  end

  # A leitura textual exige uma string, sem conversões automáticas de tipo.
  test "rejeita entradas que nao sejam strings" do
    [ nil, 4, :C4, true ].each do |text|
      assert_raises(ArgumentError) { Note.from_s(text) }
    end
  end

  # A ida e volta deve preservar os atributos, inclusive grafias enarmônicas.
  test "preserva os atributos ao converter para texto e interpretar novamente" do
    [ [ "C", 1, 4 ], [ "D", -1, 4 ], [ "B", -2, -1 ], [ "A", 2, 10 ], [ "E", 0, 0 ] ].each do |attributes|
      original = Note.new(letter: attributes[0], accidental: attributes[1], octave: attributes[2])
      parsed = Note.from_s(original.to_s)

      assert_equal attributes, [ parsed.letter, parsed.accidental, parsed.octave ]
    end
  end

  # Confere a escrita de cada acidente, incluindo a ausência de símbolo natural.
  test "representa a nota como texto" do
    {
      -2 => "Cbb4",
      -1 => "Cb4",
       0 => "C4",
       1 => "C#4",
       2 => "C##4"
    }.each do |accidental, expected|
      note = Note.new(letter: "C", accidental: accidental, octave: 4)

      assert_equal expected, note.to_s
    end
  end

  # Os acidentes permitidos devem ser preservados, inclusive os dois limites.
  test "aceita acidentes inteiros de menos dois a dois" do
    [ -2, -1, 0, 1, 2 ].each do |accidental|
      note = Note.new(letter: "C", accidental: accidental, octave: 4)
      assert_equal accidental, note.accidental
    end
  end

  # Alterações fora do escopo atual devem impedir a criação da nota.
  test "rejeita acidentes fora do intervalo permitido" do
    [ -3, 3 ].each do |accidental|
      assert_raises(ArgumentError) do
        Note.new(letter: "C", accidental: accidental, octave: 4)
      end
    end
  end

  # Não converte textos, decimais ou valores ausentes automaticamente.
  test "rejeita acidentes que nao sejam inteiros" do
    [ "1", 1.0, 0.5, nil ].each do |accidental|
      assert_raises(ArgumentError) do
        Note.new(letter: "C", accidental: accidental, octave: 4)
      end
    end
  end

  # A oitava é um índice inteiro; limites de reprodução serão definidos depois.
  test "aceita oitavas inteiras" do
    [ -1, 0, 4, 9 ].each do |octave|
      note = Note.new(letter: "C", accidental: 0, octave: octave)
      assert_equal octave, note.octave
    end
  end

  # Evita conversões implícitas e notas sem uma oitava definida.
  test "rejeita oitavas que nao sejam inteiros" do
    [ "4", 4.0, 4.5, nil, true ].each do |octave|
      assert_raises(ArgumentError) do
        Note.new(letter: "C", accidental: 0, octave: octave)
      end
    end
  end
end
