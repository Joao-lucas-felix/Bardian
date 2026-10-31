# frozen_string_literal: true

# Analisa a relação ordenada entre duas notas de origem e destino.
# Calcula deslocamentos diatônicos e cromáticos, número e qualidade,
# preservando intervalos compostos e alterações múltiplas.
# A classificação considera a direção escrita, que pode diferir
# do movimento de altura. Para uníssonos, usa a distância cromática
# absoluta por convenção do projeto, sem classificá-los como diminutos.
# A relação é imutável e mantém referências às notas recebidas.
class Interval
  # Índices das letras na sequência diatônica iniciada em dó.
  DIATONIC_POSITIONS = {
    "C" => 0, "D" => 1, "E" => 2, "F" => 3,
    "G" => 4, "A" => 5, "B" => 6
  }.freeze

  # Semitons de referência para uníssono, segunda, terça, quarta,
  # quinta, sexta e sétima, respectivamente.
  # Uníssono, quarta e quinta são justos; os demais são maiores.
  QUALITY_REFERENCE_SEMITONES = [ 0, 2, 4, 5, 7, 9, 11 ].freeze

  attr_reader :from, :to

  # Recebe as notas de origem e destino como instâncias de Note.
  # Levanta ArgumentError para outros tipos e congela o intervalo criado.
  def initialize(from:, to:)
    unless from.is_a?(Note) && to.is_a?(Note)
      raise ArgumentError, "from e to devem ser instâncias de Note"
    end

    @from = from
    @to = to
    freeze
  end

  # Retorna o deslocamento inteiro pelas letras e oitavas, sem contar acidentes.
  # Não recebe argumentos; valores negativos indicam recuo na sequência escrita.
  def diatonic_steps
    octave_steps = (to.octave - from.octave) * 7
    letter_steps = DIATONIC_POSITIONS.fetch(to.letter) -
      DIATONIC_POSITIONS.fetch(from.letter)

    octave_steps + letter_steps
  end

  # Retorna o número do intervalo pela contagem inclusiva das posições diatônicas.
  # Não recebe argumentos. Retorna um inteiro positivo: 1 para uníssono,
  # 2 para segunda, 3 para terça, e assim por diante.
  # Desconsidera a direção e os acidentes; preserva intervalos compostos.
  def number
    diatonic_steps.abs + 1
  end

  # Calcula o desvio em semitons em relação à referência maior ou justa.
  # Não recebe argumentos. Retorna um inteiro: zero indica a referência,
  # positivo indica expansão e negativo indica contração.
  # Preserva oitavas adicionais e normaliza a direção pela escrita diatônica.
  # Para uníssonos, adota a distância cromática absoluta por convenção.
  def quality_offset
    steps = diatonic_steps

    # Cada grupo de sete passos acrescenta uma oitava à referência.
    octaves, remaining_steps = steps.abs.divmod(7)
    reference = QUALITY_REFERENCE_SEMITONES.fetch(remaining_steps) +
      octaves * 12

    # A direção escrita orienta a comparação mesmo quando os acidentes
    # fazem o movimento sonoro ocorrer no sentido oposto.
    oriented_semitones = if steps.zero?
      semitones.abs
    elsif steps.negative?
      -semitones
    else
      semitones
    end

    oriented_semitones - reference
  end

  # Classifica a qualidade do intervalo, sem receber argumentos.
  # Retorna :perfect, :major, :minor, :augmented ou :diminished.
  # Alterações múltiplas compartilham a categoria aumentado ou diminuto;
  # sua magnitude permanece disponível em quality_offset.
  # Reutiliza a normalização de direção e a convenção de uníssonos existentes.
  def quality
    offset = quality_offset

    # Expandir a referência maior ou justa produz a categoria aumentado.
    return :augmented if offset.positive?

    # Reduz o número à posição simples apenas para identificar a família.
    # Oitavas correspondem ao uníssono; nonas correspondem à segunda.
    simple_number = (number - 1) % 7 + 1

    if [ 1, 4, 5 ].include?(simple_number)
      offset.zero? ? :perfect : :diminished
    else
      # Na família maior, uma contração de um semitom produz menor;
      # contrações adicionais produzem a categoria diminuto.
      case offset
      when 0 then :major
      when -1 then :minor
      else :diminished
      end
    end
  end

  # Retorna o deslocamento cromático inteiro da origem até o destino.
  # Não recebe argumentos: positivo indica subida de altura; negativo, descida;
  # zero indica a mesma altura na representação adotada.
  def semitones
    to.chromatic_position - from.chromatic_position
  end
end
