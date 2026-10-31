# frozen_string_literal: true

module Music
  # Declara identidade escrita e intervalo temporal; não possui nem modifica notas MIDI.
  class HarmonyBlock
    DURATIONS = [ 240, 480, 960, 1920 ].freeze
    QUALITIES = { "major" => [ 0, 4, 7 ], "minor" => [ 0, 3, 7 ], "diminished" => [ 0, 3, 6 ] }.freeze
    MAX_TICK = 9_007_199_254_740_991
    attr_reader :id, :onset_tick, :duration_ticks, :chord

    # Recebe campos do contrato; rejeita grafia com oitava e durações não suportadas.
    def initialize(id:, onset_tick:, duration_ticks:, chord:)
      @id = Contract.label(id, "id")
      @onset_tick = Contract.integer(onset_tick, "onset_tick", min: 0, max: MAX_TICK)
      @duration_ticks = Contract.integer(duration_ticks, "duration_ticks", min: 1)
      raise ArgumentError, "duração de bloco inválida" unless DURATIONS.include?(@duration_ticks) && @onset_tick + @duration_ticks <= MAX_TICK
      raise ArgumentError, "acorde inválido" unless chord.is_a?(Hash) && chord.keys.sort == %w[quality root]
      root = chord["root"]
      raise ArgumentError, "fundamental inválida" unless root.is_a?(String) && /\A[A-G](bb|b|##|#)?\z/.match?(root)
      Note.from_s("#{root}4")
      raise ArgumentError, "qualidade inválida" unless QUALITIES.key?(chord["quality"])
      @chord = chord.transform_values { |value| value.dup.freeze }.freeze
      freeze
    end

    # Reconstrói apenas a forma declarada, rejeitando campos que seriam perdidos.
    def self.from_h(data)
      raise ArgumentError, "bloco inválido" unless data.is_a?(Hash) && data.keys.sort == %w[chord duration_ticks id onset_tick]
      new(id: data["id"], onset_tick: data["onset_tick"], duration_ticks: data["duration_ticks"], chord: data["chord"])
    end

    # Devolve cópia independente para JSON; nenhum grau ou função é persistido.
    def to_h
      { "id" => id.dup, "onset_tick" => onset_tick, "duration_ticks" => duration_ticks, "chord" => chord.transform_values(&:dup) }
    end

    # Deriva classes cromáticas da declaração para comparação com a realização.
    def pitch_classes
      root = Note.from_s("#{chord.fetch('root')}4").chromatic_position
      QUALITIES.fetch(chord.fetch("quality")).map { |offset| (root + offset) % 12 }
    end

    # Cifra permanece disponível mesmo quando o acorde está fora do campo atual.
    def symbol
      chord.fetch("root") + { "major" => "", "minor" => "m", "diminished" => "°" }.fetch(chord.fetch("quality"))
    end
  end
end
