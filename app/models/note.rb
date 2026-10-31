# frozen_string_literal: true

# Representa uma altura musical por letra, acidente e oitava.
# Preserva a grafia nas comparações e transposições, distinguindo
# igualdade de escrita de equivalência de altura.
# Adota 12 semitons por oitava e acidentes inteiros de -2 a 2.
# Não representa duração, intensidade ou posição temporal na composição.
# É imutável: alterações exigem a construção de uma nova nota.
class Note
  attr_reader :letter, :accidental, :octave

  # Letras naturais usadas na representação musical.
  # %w cria um array de strings; freeze impede alterações nesse array.
  VALID_LETTERS = %w[A B C D E F G].freeze

  # Sequência diatônica iniciada em dó, onde ocorre a mudança de oitava.
  DIATONIC_LETTERS = %w[C D E F G A B].freeze

  # Posição das letras naturais em semitons, contando a partir de dó.
  NATURAL_POSITIONS = {
    "C" => 0,
    "D" => 2,
    "E" => 4,
    "F" => 5,
    "G" => 7,
    "A" => 9,
    "B" => 11
  }.freeze

  # Símbolos textuais dos acidentes; a nota natural não recebe sufixo.
  # Acidentes duplos são escritos como "bb" e "##".
  ACCIDENTAL_SYMBOLS = {
    -2 => "bb",
    -1 => "b",
    0 => "",
    1 => "#",
    2 => "##"
  }.freeze

  # Inicializa e congela a nota, preservando sua escrita musical.
  # letter: string maiúscula de A a G.
  # accidental: alteração inteira de -2 a 2 semitons em relação à nota natural.
  # octave: número inteiro da oitava, sem limites de reprodução nesta etapa.
  # Levanta ArgumentError quando a letra, o acidente ou a oitava é inválido.
  def initialize(letter:, accidental:, octave:)
    unless VALID_LETTERS.include?(letter)
      raise ArgumentError, "letter deve ser uma das letras: A, B, C, D, E, F, G"
    end

    # Aceita alterações inteiras de até dois semitons em cada direção.
    # A checagem de tipo impede aceitar strings ou valores fracionários.
    unless accidental.is_a?(Integer) && accidental.between?(-2, 2)
      raise ArgumentError, "accidental deve ser um inteiro entre -2 e 2"
    end

    # Exige uma oitava inteira sem converter textos ou números decimais.
    unless octave.is_a?(Integer)
      raise ArgumentError, "octave deve ser um inteiro"
    end

    # Copia a letra para não compartilhar uma string mutável com quem criou a nota.
    # Congela a cópia para impedir alterações por meio do leitor letter.
    @letter = letter.dup.freeze

    # Inteiros já são imutáveis em Ruby.
    @accidental = accidental
    @octave = octave

    # Impede a reatribuição das variáveis de instância após a construção.
    freeze
  end

  # Interpreta uma string no formato letra, acidente opcional e oitava.
  # text: escrita musical como "C4", "Db4" ou "F##-1".
  # Retorna uma nova Note, validada pelo construtor.
  # Levanta ArgumentError se a entrada não for uma string no formato esperado.
  def self.from_s(text)
    unless text.is_a?(String)
      raise ArgumentError, "a nota deve ser informada como string"
    end

    # Captura letra, acidente e oitava, exigindo correspondência da string inteira.
    # A oitava aceita zero ou inteiros sem zeros iniciais; "-0" não é permitido.
    match = /\A([A-G])(bb|b|##|#)?(0|-?[1-9][0-9]*)\z/.match(text)

    unless match
      raise ArgumentError, "formato de nota inválido: use exemplos como C4 ou Db4"
    end

    # Sem símbolo explícito, a nota é natural.
    accidental = ACCIDENTAL_SYMBOLS.key(match[2] || "")

    # Reutiliza as validações existentes para construir a nota.
    new(
      letter: match[1],
      accidental: accidental,
      octave: Integer(match[3], 10)
    )
  end

  # Calcula a posição cromática em semitons, usando C0 como zero.
  # Não recebe argumentos. Retorna um inteiro, que pode ser negativo.
  # Considera 12 semitons por oitava e preserva a escrita original da nota.
  # O resultado não é um número MIDI nem uma frequência.
  def chromatic_position
    octave * 12 + NATURAL_POSITIONS.fetch(letter) + accidental
  end

  # Transpõe a nota preservando o deslocamento escrito e a altura solicitada.
  # diatonic_steps: inteiro com sinal que indica quantos passos entre letras mover.
  # semitones: inteiro com sinal que indica o deslocamento cromático.
  # Retorna uma nova Note imutável, sem modificar a origem.
  # Levanta ArgumentError para parâmetros não inteiros ou quando o resultado
  # exige um acidente fora de -2..2, sem substituir a grafia por uma equivalente.
  def transpose(diatonic_steps:, semitones:)
    unless diatonic_steps.is_a?(Integer) && semitones.is_a?(Integer)
      raise ArgumentError, "diatonic_steps e semitones devem ser inteiros"
    end

    # Converte a escrita em uma posição contínua de sete letras por oitava.
    destination_position = octave * 7 +
      DIATONIC_LETTERS.index(letter) + diatonic_steps

    # divmod também resolve corretamente posições abaixo de C0.
    destination_octave, letter_index = destination_position.divmod(7)
    destination_letter = DIATONIC_LETTERS.fetch(letter_index)

    # O acidente concilia a letra escolhida com a altura desejada.
    natural_position = destination_octave * 12 +
      NATURAL_POSITIONS.fetch(destination_letter)
    destination_accidental = chromatic_position + semitones - natural_position

    # Reutiliza a validação de acidentes e a imutabilidade do construtor.
    Note.new(
      letter: destination_letter,
      accidental: destination_accidental,
      octave: destination_octave
    )
  end

  # Compara a altura de duas notas na representação de 12 semitons por oitava.
  # other: objeto a comparar; objetos que não sejam Note retornam false.
  # Retorna true quando as posições cromáticas são iguais, mesmo com grafias distintas.
  def same_pitch?(other)
    other.is_a?(Note) &&
      chromatic_position == other.chromatic_position
  end

  # Compara a escrita musical e a oitava de duas notas.
  # other: objeto a comparar; objetos que não sejam Note retornam false.
  # Retorna true quando letra, acidente e oitava são iguais.
  # Não verifica equivalência de altura entre grafias diferentes.
  def ==(other)
    other.is_a?(Note) &&
      letter == other.letter &&
      accidental == other.accidental &&
      octave == other.octave
  end

  # Compara notas por valor para uso em Hash e Set.
  # other: objeto a comparar.
  # Retorna o mesmo resultado de ==, preservando a distinção de escrita.
  def eql?(other)
    self == other
  end

  # Calcula o código de dispersão usado por Hash e Set.
  # Não recebe argumentos. Retorna um inteiro derivado dos atributos.
  # Notas iguais por eql? devem produzir o mesmo hash.
  def hash
    [ letter, accidental, octave ].hash
  end

  # Retorna a escrita da nota como string, combinando letra, acidente e oitava.
  # Não recebe argumentos. Exemplo: dó sustenido na oitava 4 retorna "C#4".
  def to_s
    "#{letter}#{ACCIDENTAL_SYMBOLS.fetch(accidental)}#{octave}"
  end
end
