# frozen_string_literal: true

module Music
  # Constrói tríades diatônicas e seus rótulos a partir da escala declarada.
  class HarmonicField
    # Agrupa um acorde, sua grafia e uma função didática simplificada.
    Degree = Data.define(:numeral, :symbol, :function, :note_names, :pitch_classes)
    NUMERALS = {
      "major" => %w[I ii iii IV V vi vii°],
      "natural_minor" => %w[i ii° III iv v VI VII]
    }.freeze
    FUNCTIONS = %w[tonic predominant tonic predominant dominant tonic dominant].freeze
    attr_reader :context, :degrees

    # Recebe contexto validado e deriva sete tríades por terças da escala.
    def initialize(context)
      raise ArgumentError, "context inválido" unless context.is_a?(MusicalContext)

      @context = context
      notes = context.scale.notes
      @degrees = notes.each_index.map do |index|
        root = notes.fetch(index)
        third = notes.fetch((index + 2) % 7)
        fifth = notes.fetch((index + 4) % 7)
        quality = [ (third.chromatic_position - root.chromatic_position) % 12,
          (fifth.chromatic_position - root.chromatic_position) % 12 ]
        type = { [ 4, 7 ] => "", [ 3, 7 ] => "m", [ 3, 6 ] => "°" }.fetch(quality)
        pattern = case type
        when "" then ChordPattern.major_triad
        when "m" then ChordPattern.minor_triad
        else ChordPattern.new(intervals: [
          IntervalSpec.new(number: 1, quality: :perfect, direction: :ascending),
          IntervalSpec.new(number: 3, quality: :minor, direction: :ascending),
          IntervalSpec.new(number: 5, quality: :diminished, direction: :ascending)
        ])
        end
        chord = Chord.new(root: root, pattern: pattern)
        names = chord.notes.map { |note| note.to_s.sub(/-?\d+\z/, "") }.freeze
        Degree.new(numeral: NUMERALS.fetch(context.mode).fetch(index),
          symbol: "#{names.first}#{type}".freeze, function: FUNCTIONS.fetch(index),
          note_names: names, pitch_classes: chord.notes.map { |note| note.chromatic_position % 12 }.freeze)
      end.freeze
      freeze
    end

    # Produz uma projeção simples para a interface, sem gravá-la no documento.
    def to_h
      degrees.map do |degree|
        { "degree" => degree.numeral, "symbol" => degree.symbol,
          "function" => degree.function, "notes" => degree.note_names,
          "pitch_classes" => degree.pitch_classes }
      end
    end
  end
end
