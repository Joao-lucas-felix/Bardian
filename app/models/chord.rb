# frozen_string_literal: true

# Associa uma fundamental a um padrão e calcula as notas do acorde.
# Cada intervalo parte da mesma fundamental, preservando grafia e ordem.
# O acorde e sua lista de notas são imutáveis.
# Não identifica qualidade, inversão ou função harmônica automaticamente.
class Chord
  attr_reader :root, :pattern, :notes

  # Constrói o acorde e calcula todas as notas.
  # root: Note que representa a fundamental, com oitava definida.
  # pattern: ChordPattern com os intervalos relativos à fundamental.
  # Disponibiliza o resultado pelo leitor notes, sem modificar as entradas.
  # Levanta ArgumentError para tipos inválidos ou quando uma transposição
  # exige um acidente fora dos limites de Note.
  def initialize(root:, pattern:)
    unless root.is_a?(Note)
      raise ArgumentError, "root deve ser uma instância de Note"
    end

    unless pattern.is_a?(ChordPattern)
      raise ArgumentError, "pattern deve ser uma instância de ChordPattern"
    end

    @root = root
    @pattern = pattern

    # A terça e a quinta, por exemplo, são calculadas desde a fundamental.
    @notes = pattern.intervals.map { |interval| interval.apply_to(root) }.freeze
    freeze
  end
end
