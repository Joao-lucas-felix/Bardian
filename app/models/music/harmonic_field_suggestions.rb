# frozen_string_literal: true

module Music
  # Fonte determinística inicial; outras fontes podem implementar o mesmo #call.
  class HarmonicFieldSuggestions
    # Recebe campo, eventos selecionados e região; devolve possibilidades JSON.
    # Só acordes com classes coincidentes aparecem, por ordem de coincidência.
    def call(field:, selected:, region:)
      anchor = selected.min_by { |note| [ note.onset_tick, note.pitch ] }
      onset = anchor&.onset_tick || 0
      duration = [ anchor&.duration_ticks || Composition::TICKS_PER_QUARTER, region.duration_ticks - onset ].min
      reference_pitch = anchor&.pitch || 60
      field.degrees.filter_map do |degree|
        matches = selected.count { |note| degree.pitch_classes.include?(note.pitch % 12) }
        next if matches.zero?

        root = degree.pitch_classes.first
        base = (reference_pitch / 12) * 12 + root
        base -= 12 if base > reference_pitch + 6
        base += 12 if base < 0
        pitches = degree.pitch_classes.map { |pitch_class| base + (pitch_class - root) % 12 }
        next if pitches.any? { |pitch| pitch > 127 }

        { "degree" => degree.numeral, "symbol" => degree.symbol,
          "function" => degree.function, "notes" => degree.note_names,
          "matching_notes" => matches, "pitches" => pitches,
          "onset" => onset, "duration" => duration }
      end.sort_by { |candidate| [ -candidate.fetch("matching_notes"), field.degrees.index { |degree| degree.numeral == candidate.fetch("degree") } ] }
    end
  end
end
