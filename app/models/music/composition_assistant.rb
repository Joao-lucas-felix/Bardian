# frozen_string_literal: true

module Music
  # Lê uma seleção da composição validada e devolve possibilidades explicáveis.
  class CompositionAssistant
    attr_reader :composition

    # Recebe o mesmo documento imutável usado pela persistência e reprodução.
    def initialize(composition, suggestion_source: HarmonicFieldSuggestions.new)
      raise ArgumentError, "composição inválida" unless composition.is_a?(Composition)
      raise ArgumentError, "fonte de sugestões inválida" unless suggestion_source.respond_to?(:call)

      @composition = composition
      @suggestion_source = suggestion_source
    end

    # Identifica a região, classifica alturas e oferece acordes com notas coincidentes.
    # IDs vazios usam todas as notas da região; bateria preserva o campo, sem analisar alturas.
    def analyze(track_id:, region_id:, note_ids:)
      raise ArgumentError, "seleção inválida" unless note_ids.is_a?(Array) && note_ids.all? { |id| id.is_a?(String) }

      neutral = { "status" => "uncontextualized", "field" => [], "out_of_context_ids" => [], "suggestions" => [] }
      return neutral unless composition.context
      field = HarmonicField.new(composition.context)
      return neutral.merge("status" => "contextualized", "field" => field.to_h) if track_id.nil? && region_id.nil?

      track = composition.tracks.find { |item| item.id == track_id }
      region = track&.regions&.find { |item| item.id == region_id }
      raise ArgumentError, "região não encontrada" unless region

      unknown = note_ids - region.notes.map(&:id)
      raise ArgumentError, "nota fora da região" if unknown.any?

      selected = note_ids.empty? ? region.notes : region.notes.select { |note| note_ids.include?(note.id) }
      return neutral.merge("status" => "non_tonal_track", "field" => field.to_h) if track.instrument_id == "drums"

      scale_classes = composition.context.scale.notes.map { |note| note.chromatic_position % 12 }
      outside = region.notes.reject { |note| scale_classes.include?(note.pitch % 12) }.map(&:id)
      suggestions = @suggestion_source.call(field: field, selected: selected, region: region)

      { "status" => "contextualized", "field" => field.to_h,
        "out_of_context_ids" => outside, "suggestions" => suggestions }
    end
  end
end
