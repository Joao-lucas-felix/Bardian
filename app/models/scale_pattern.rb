# frozen_string_literal: true

# Representa um padrão como sequência imutável de intervalos.
# Cada intervalo descreve uma posição em relação à mesma nota inicial.
# Preserva a ordem recebida, sem exigir uma quantidade fixa de posições.
# Não calcula notas nem identifica o tipo musical da escala.
class ScalePattern
  attr_reader :intervals

  # Constrói o padrão maior com sete posições, sem repetir a oitava.
  # Não recebe argumentos. Retorna um novo ScalePattern imutável.
  # Os intervalos são ascendentes e relativos à mesma nota inicial:
  # uníssono justo, segunda maior, terça maior, quarta justa,
  # quinta justa, sexta maior e sétima maior.
  def self.major
    qualities = [
      :perfect, :major, :major, :perfect, :perfect, :major, :major
    ]

    # A posição na lista determina o número inclusivo do intervalo.
    intervals = qualities.each_with_index.map do |quality, index|
      IntervalSpec.new(
        number: index + 1,
        quality: quality,
        direction: :ascending
      )
    end

    new(intervals: intervals)
  end

  # Constrói o padrão menor natural com sete posições, sem repetir a oitava.
  # Não recebe argumentos. Retorna um novo ScalePattern imutável.
  # Os intervalos são ascendentes e relativos à mesma nota inicial:
  # uníssono justo, segunda maior, terça menor, quarta justa,
  # quinta justa, sexta menor e sétima menor.
  def self.natural_minor
    qualities = [
      :perfect, :major, :minor, :perfect, :perfect, :minor, :minor
    ]

    # A posição na lista determina o número inclusivo do intervalo.
    intervals = qualities.each_with_index.map do |quality, index|
      IntervalSpec.new(
        number: index + 1,
        quality: quality,
        direction: :ascending
      )
    end

    new(intervals: intervals)
  end

  # Constrói um padrão a partir de uma lista ordenada.
  # intervals: Array não vazio contendo apenas objetos IntervalSpec.
  # Copia e congela a lista, sem modificar o array recebido.
  # Os elementos são compartilhados porque IntervalSpec já é imutável.
  # Levanta ArgumentError para lista vazia, outro tipo ou elementos inválidos.
  def initialize(intervals:)
    unless intervals.is_a?(Array) && !intervals.empty?
      raise ArgumentError, "intervals deve ser um Array não vazio"
    end

    unless intervals.all? { |interval| interval.is_a?(IntervalSpec) }
      raise ArgumentError, "intervals deve conter apenas objetos IntervalSpec"
    end

    # A cópia evita que mudanças na lista original alterem o padrão.
    @intervals = intervals.dup.freeze
    freeze
  end
end
