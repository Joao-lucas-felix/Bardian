# frozen_string_literal: true

module Music
  # Raiz do estado musical em memória; UI, áudio e persistência consumirão seu contrato.
  class Composition
    VERSION = 1
    TICKS_PER_QUARTER = 480
    VALID_DENOMINATORS = [ 1, 2, 4, 8, 16, 32, 64 ].freeze

    attr_reader :id, :name, :bpm, :time_signature, :tracks, :loop_range, :context, :harmony_blocks

    # Recebe faixas, métrica e marcadores opcionais; rejeita limites e IDs inválidos.
    # loop_range usa ticks absolutos e nil preserva o contrato anterior.
    def initialize(id:, name:, bpm:, time_signature:, tracks:, loop_range: nil, context: nil, harmony_blocks: nil)
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
      raise ArgumentError, "context inválido" if context && !context.is_a?(MusicalContext)
      @context = context
      if loop_range
        raise ArgumentError, "loop inválido" unless loop_range.is_a?(Hash) &&
          loop_range.keys.sort == [ "end_tick", "start_tick" ]

        start_tick = Contract.integer(Contract.required(loop_range, "start_tick"), "start_tick", min: 0)
        end_tick = Contract.integer(Contract.required(loop_range, "end_tick"), "end_tick", min: 1)
        raise ArgumentError, "fim do loop deve superar o início" unless end_tick > start_tick

        @loop_range = { "start_tick" => start_tick, "end_tick" => end_tick }.freeze
      end
      @harmony_blocks = harmony_blocks&.dup&.freeze
      unless @harmony_blocks.nil?
        raise ArgumentError, "limite de 32 blocos" unless @harmony_blocks.is_a?(Array) && @harmony_blocks.length <= 32
        expected = 0
        @harmony_blocks.each do |block|
          raise ArgumentError, "blocos devem ser contíguos desde zero" unless block.is_a?(HarmonyBlock) && block.onset_tick == expected
          expected += block.duration_ticks
        end
      end
      validate_unique_ids!
      freeze
    end

    # Reconstrói a composição de um hash JSON da versão conhecida do contrato.
    def self.from_h(data)
      raise ArgumentError, "versão do contrato desconhecida" unless Contract.required(data, "version") == VERSION
      raise ArgumentError, "loop inválido" if data.key?("loop") && !data["loop"].is_a?(Hash)
      raise ArgumentError, "context inválido" if data.key?("context") && !data["context"].is_a?(Hash)

      blocks = nil
      if data.key?("harmony")
        harmony = data["harmony"]
        raise ArgumentError, "harmonia inválida" unless harmony.is_a?(Hash) && harmony.keys == [ "blocks" ]
        blocks = Contract.items(harmony["blocks"], "blocks").map { |block| HarmonyBlock.from_h(block) }
      end
      tracks = Contract.items(Contract.required(data, "tracks"), "tracks").map { |track| Track.from_h(track) }
      new(id: Contract.required(data, "id"), name: Contract.required(data, "name"),
        bpm: Contract.required(data, "bpm"),
        time_signature: Contract.required(data, "time_signature"), tracks: tracks,
        loop_range: data["loop"], context: data["context"] && MusicalContext.from_h(data["context"]), harmony_blocks: blocks)
    end

    # Calcula ticks por batida a partir da semínima fixa; BPM muda segundos, não posições.
    def ticks_per_beat
      TICKS_PER_QUARTER * 4 / time_signature["denominator"]
    end

    # Devolve uma árvore de hashes e listas pronta para JSON, sem compartilhar listas internas.
    def to_h
      result = { "version" => VERSION, "id" => id, "name" => name, "bpm" => bpm,
        "time_signature" => time_signature.dup, "tracks" => tracks.map(&:to_h) }
      result["loop"] = loop_range.dup if loop_range
      result["context"] = context.to_h if context
      result["harmony"] = { "blocks" => harmony_blocks.map(&:to_h) } unless harmony_blocks.nil?
      result
    end

    private

    # IDs únicos evitam que seleção ou atualização alcance a entidade errada.
    def validate_unique_ids!
      ids = [ id ] + (harmony_blocks || []).map(&:id)
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
