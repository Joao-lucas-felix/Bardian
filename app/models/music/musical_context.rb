# frozen_string_literal: true

module Music
  # Representa a tonalidade declarada, sem inferir sua relação com as notas MIDI.
  class MusicalContext
    MODES = %w[major natural_minor].freeze
    TONICS = %w[C C# D Eb E F F# G Ab A Bb B].freeze
    attr_reader :tonic, :mode

    # Recebe classe escrita e modo; limita a primeira versão às doze grafias da interface.
    def initialize(tonic:, mode:)
      raise ArgumentError, "tonic inválida" unless TONICS.include?(tonic)
      raise ArgumentError, "mode inválido" unless MODES.include?(mode)

      @tonic = tonic.dup.freeze
      @mode = mode.dup.freeze
      freeze
    end

    # Reconstrói o par completo do JSON; nenhum dos dois campos pode faltar.
    def self.from_h(data)
      raise ArgumentError, "context inválido" unless data.is_a?(Hash) && data.keys.sort == %w[mode tonic]

      new(tonic: data.fetch("tonic"), mode: data.fetch("mode"))
    end

    # Devolve cópias para serialização sem expor strings internas mutáveis.
    def to_h
      { "tonic" => tonic.dup, "mode" => mode.dup }
    end

    # Usa a grafia existente do domínio para obter as sete notas diatônicas.
    def scale
      Scale.new(root: Note.from_s("#{tonic}4"),

        # Quando expanirmos os padrões de escala, podemos usar o mesmo nome de modo para mapear para a classe correta.
        pattern: mode == "major" ? ScalePattern.major : ScalePattern.natural_minor)
    end
  end
end
