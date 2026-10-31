# frozen_string_literal: true

module Music
  # Agrupa regiões independentes e parâmetros que futuramente orientarão o áudio.
  class Track
    attr_reader :id, :name, :instrument_id, :volume, :mute, :solo, :regions

    # Recebe identidade, instrumento estável, volume entre 0 e 1 e regiões da faixa.
    def initialize(id:, name:, instrument_id:, volume:, mute:, solo:, regions:)
      @id = Contract.label(id, "id")
      @name = Contract.label(name, "name")
      @instrument_id = Contract.label(instrument_id, "instrument_id")
      @volume = Contract.number(volume, "volume", min: 0, max: 1)
      @mute = Contract.boolean(mute, "mute")
      @solo = Contract.boolean(solo, "solo")
      @regions = Contract.items(regions, "regions").map do |region|
        raise ArgumentError, "região inválida" unless region.is_a?(MidiRegion)

        region
      end.freeze
      freeze
    end

    # Lê a faixa validando cada região sem converter instrument_id em timbre.
    def self.from_h(data)
      regions = Contract.items(Contract.required(data, "regions"), "regions").map { |region| MidiRegion.from_h(region) }
      new(id: Contract.required(data, "id"), name: Contract.required(data, "name"),
        instrument_id: Contract.required(data, "instrument_id"),
        volume: Contract.required(data, "volume"), mute: Contract.required(data, "mute"),
        solo: Contract.required(data, "solo"), regions: regions)
    end

    # Serializa a faixa preservando a ordem explícita de suas regiões.
    def to_h
      { "id" => id, "name" => name, "instrument_id" => instrument_id,
        "volume" => volume, "mute" => mute, "solo" => solo,
        "regions" => regions.map(&:to_h) }
    end
  end
end
