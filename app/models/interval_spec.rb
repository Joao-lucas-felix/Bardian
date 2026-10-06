# frozen_string_literal: true

# Descreve um intervalo por número, qualidade, direção e multiplicidade,
# sem exigir notas de origem e destino na construção.
# Converte a descrição em passos diatônicos e semitons e permite
# aplicá-la a uma Note, produzindo outra nota com a grafia solicitada.
# Reutiliza a referência cromática de Interval e delega a transposição
# a Note, respeitando seu limite de acidentes.
# A descrição é imutável e não aceita uníssono diminuto.
class IntervalSpec
  attr_reader :number, :quality, :direction, :multiplicity

  # Cria uma descrição imutável de intervalo.
  # number: inteiro positivo; aceita intervalos simples e compostos.
  # quality: :perfect, :major, :minor, :augmented ou :diminished,
  # conforme a família do número informado.
  # direction: :ascending ou :descending; não há direção implícita.
  # multiplicity: inteiro positivo; valores acima de 1 indicam alterações
  # múltiplas e só são permitidos para aumentado ou diminuto.
  # Levanta ArgumentError para tipos ou combinações inválidas.
  # Por convenção do projeto, não aceita uníssono diminuto.
  def initialize(number:, quality:, direction:, multiplicity: 1)
    unless number.is_a?(Integer) && number.positive?
      raise ArgumentError, "number deve ser um inteiro positivo"
    end

    unless [ :ascending, :descending ].include?(direction)
      raise ArgumentError, "direction deve ser :ascending ou :descending"
    end

    # A redução identifica a família sem descartar o número original.
    simple_number = (number - 1) % 7 + 1
    allowed_qualities = if [ 1, 4, 5 ].include?(simple_number)
      [ :perfect, :augmented, :diminished ]
    else
      [ :major, :minor, :augmented, :diminished ]
    end

    unless allowed_qualities.include?(quality)
      raise ArgumentError, "quality incompatível com o número do intervalo"
    end

    unless multiplicity.is_a?(Integer) && multiplicity.positive?
      raise ArgumentError, "multiplicity deve ser um inteiro positivo"
    end

    # Maior, menor e justo não possuem versões duplas ou triplas.
    if multiplicity != 1 && ![ :augmented, :diminished ].include?(quality)
      raise ArgumentError, "multiplicity acima de 1 exige aumentado ou diminuto"
    end

    # Mantém a convenção de classificação usada pelos intervalos entre notas.
    if number == 1 && quality == :diminished
      raise ArgumentError, "uníssono diminuto não é suportado pela convenção atual"
    end

    @number = number
    @quality = quality
    @direction = direction
    @multiplicity = multiplicity
    freeze
  end

  # Converte o número do intervalo em deslocamento diatônico.
  # Não recebe argumentos. Retorna um inteiro com sinal conforme a direção.
  # Uníssonos retornam zero, pois permanecem na mesma letra e oitava.
  def diatonic_steps
    (number - 1) * direction_multiplier
  end

  # Calcula o deslocamento cromático, incluindo qualidade e multiplicidade.
  # Não recebe argumentos. Retorna um inteiro em semitons.
  # Reutiliza a referência maior ou justa definida em Interval.
  # A direção orienta a escrita; diminuições múltiplas podem produzir
  # movimento sonoro contrário a ela. Não aplica limites de reprodução.
  def semitones
    octaves, remaining_steps = (number - 1).divmod(7)
    reference = Interval::QUALITY_REFERENCE_SEMITONES.fetch(remaining_steps) +
      octaves * 12

    adjustment = case quality
    when :perfect, :major
      0
    when :minor
      -1
    when :augmented
      multiplicity
    when :diminished
      # Na família maior, primeiro contraímos até menor e só então diminuímos.
      perfect_family = [ 0, 3, 4 ].include?(remaining_steps)
      perfect_family ? -multiplicity : -(multiplicity + 1)
    end

    (reference + adjustment) * direction_multiplier
  end

  # Aplica o intervalo a uma nota, preservando a escrita musical.
  # note: instância de Note que representa a origem.
  # Retorna uma nova Note imutável, sem modificar a origem ou a descrição.
  # Levanta ArgumentError se a entrada não for Note ou se a transposição
  # exigir um acidente fora do limite -2..2 adotado por Note.
  def apply_to(note)
    unless note.is_a?(Note)
      raise ArgumentError, "note deve ser uma instância de Note"
    end

    # Delega a construção da nota ao cálculo de transposição existente.
    note.transpose(
      diatonic_steps: diatonic_steps,
      semitones: semitones
    )
  end

  private

  # Converte a direção validada em um fator numérico.
  # Não recebe argumentos. Retorna 1 para ascendente e -1 para descendente.
  def direction_multiplier
    direction == :ascending ? 1 : -1
  end
end
