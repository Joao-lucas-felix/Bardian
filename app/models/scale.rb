# frozen_string_literal: true

# Associa uma nota inicial a um padrão e calcula suas notas.
# Cada intervalo é aplicado à mesma origem, preservando a ordem do padrão.
# Não acrescenta repetição na oitava nem impõe uma quantidade de notas.
# A escala e sua lista de notas são imutáveis.
class Scale
  attr_reader :root, :pattern, :notes

  # Constrói a escala e calcula todas as notas.
  # root: Note usada como referência para todos os intervalos.
  # pattern: ScalePattern que determina as posições e sua ordem.
  # Disponibiliza as notas resultantes pelo leitor notes, sem alterar as entradas.
  # Levanta ArgumentError para tipos inválidos ou quando alguma transposição
  # exige um acidente fora dos limites de Note.
  def initialize(root:, pattern:)
    unless root.is_a?(Note)
      raise ArgumentError, "root deve ser uma instância de Note"
    end

    unless pattern.is_a?(ScalePattern)
      raise ArgumentError, "pattern deve ser uma instância de ScalePattern"
    end

    @root = root
    @pattern = pattern

    # Todos os deslocamentos partem da origem, não da nota anterior.
    @notes = pattern.intervals.map { |interval| interval.apply_to(root) }.freeze
    freeze
  end
end
