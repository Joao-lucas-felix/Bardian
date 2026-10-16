# frozen_string_literal: true

module Music
  # Raiz do estado musical em memória; UI, áudio e persistência consumirão seu contrato.
  class Composition
    VERSION = 1
    TICKS_PER_QUARTER = 480
    VALID_DENOMINATORS = [ 1, 2, 4, 8, 16, 32, 64 ].freeze

    attr_reader :id, :name, :bpm, :time_signature, :tracks

    # Recebe faixas ordenadas, andamento e compasso; rejeita IDs repetidos na árvore.
    def initialize(id:, name:, bpm:, time_signature:, tracks:)
      @id = Contract.label(id, "id")
      @name = Contract.label(name, "name")
      @bpm = Contract.number(bpm, "bpm", min: 0, exclusive_min: true)
      numerator = Contract.integer(Contract.required(time_signature, "numerator"), "numerator", min: 1)
      denominator = Contract.required(time_signature, "denominator")
      raise ArgumentError, "denominator inválido" unless VALID_DENOMINATORS.include?(denominator)

      @time_signature = { "numerator" => numerator, "denominator" => denominator }.freeze
      @tracks = Contract.items(tracks, "tracks").map do |track|
        raise ArgumentError, "faixa inválida" unless track.is_a?(Track)

        track
      end.freeze
      validate_unique_ids!
      freeze
    end

    # Reconstrói a composição de um hash JSON da versão conhecida do contrato.
    def self.from_h(data)
      raise ArgumentError, "versão do contrato desconhecida" unless Contract.required(data, "version") == VERSION

      tracks = Contract.items(Contract.required(data, "tracks"), "tracks").map { |track| Track.from_h(track) }
      new(id: Contract.required(data, "id"), name: Contract.required(data, "name"),
        bpm: Contract.required(data, "bpm"),
        time_signature: Contract.required(data, "time_signature"), tracks: tracks)
    end

    # Calcula ticks por batida a partir da semínima fixa; BPM muda segundos, não posições.
    def ticks_per_beat
      TICKS_PER_QUARTER * 4 / time_signature["denominator"]
    end

    # Devolve uma árvore de hashes e listas pronta para JSON, sem compartilhar listas internas.
    def to_h
      { "version" => VERSION, "id" => id, "name" => name, "bpm" => bpm,
        "time_signature" => time_signature.dup, "tracks" => tracks.map(&:to_h) }
    end

    private

    # IDs únicos evitam que seleção ou atualização alcance a entidade errada.
    def validate_unique_ids!
      ids = [ id ]
      tracks.each do |track|
        ids << track.id
        track.regions.each do |region|
          ids << region.id
          ids.concat(region.notes.map(&:id))
        end
      end
      raise ArgumentError, "IDs musicais repetidos" unless ids.uniq.length == ids.length
    end
  end
end
