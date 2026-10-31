# frozen_string_literal: true

# Representa um padrão de acorde por intervalos relativos à fundamental.
# Preserva a ordem recebida e mantém a sequência imutável.
# Não calcula notas nem identifica automaticamente a qualidade do acorde.
class ChordPattern
  attr_reader :intervals

  # Constrói o padrão de tríade maior em posição fundamental.
  # Não recebe argumentos. Retorna um novo ChordPattern imutável.
  # Usa uníssono justo, terça maior e quinta justa, todos ascendentes
  # e relativos à mesma fundamental.
  def self.major_triad
    new(intervals: [
      IntervalSpec.new(number: 1, quality: :perfect, direction: :ascending),
      IntervalSpec.new(number: 3, quality: :major, direction: :ascending),
      IntervalSpec.new(number: 5, quality: :perfect, direction: :ascending)
    ])
  end

  # Constrói o padrão de tríade menor em posição fundamental.
  # Não recebe argumentos. Retorna um novo ChordPattern imutável.
  # Usa uníssono justo, terça menor e quinta justa, todos ascendentes
  # e relativos à mesma fundamental.
  def self.minor_triad
    new(intervals: [
      IntervalSpec.new(number: 1, quality: :perfect, direction: :ascending),
      IntervalSpec.new(number: 3, quality: :minor, direction: :ascending),
      IntervalSpec.new(number: 5, quality: :perfect, direction: :ascending)
    ])
  end

  # Constrói um padrão a partir de uma lista ordenada.
  # intervals: Array não vazio contendo apenas objetos IntervalSpec.
  # Copia e congela a lista, sem modificar o array recebido.
  # Compartilha os intervalos porque IntervalSpec já é imutável.
  # Levanta ArgumentError para lista vazia, outro tipo ou elementos inválidos.
  def initialize(intervals:)
    unless intervals.is_a?(Array) && !intervals.empty?
      raise ArgumentError, "intervals deve ser um Array não vazio"
    end

    unless intervals.all? { |interval| interval.is_a?(IntervalSpec) }
      raise ArgumentError, "intervals deve conter apenas objetos IntervalSpec"
    end

    # Impede que alterações na lista original modifiquem o padrão.
    @intervals = intervals.dup.freeze
    freeze
  end
end
