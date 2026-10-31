# frozen_string_literal: true

module Music
  # Posiciona uma sequência de notas MIDI em uma faixa da composição.
  class MidiRegion
    attr_reader :id, :start_tick, :duration_ticks, :notes

    # Recebe início absoluto, duração positiva e notas com início relativo à região.
    def initialize(id:, start_tick:, duration_ticks:, notes:)
      @id = Contract.label(id, "id")
      @start_tick = Contract.integer(start_tick, "start_tick", min: 0)
      @duration_ticks = Contract.integer(duration_ticks, "duration_ticks", min: 1)
      @notes = Contract.items(notes, "notes").map do |note|
        raise ArgumentError, "nota inválida" unless note.is_a?(NoteEvent)
        raise ArgumentError, "nota excede região" if note.onset_tick + note.duration_ticks > @duration_ticks

        note
      end.freeze
      freeze
    end

    # Valida notas de uma região recebida por JSON antes de expô-la ao domínio.
    def self.from_h(data)
      notes = Contract.items(Contract.required(data, "notes"), "notes").map { |note| NoteEvent.from_h(note) }
      new(id: Contract.required(data, "id"), start_tick: Contract.required(data, "start_tick"),
        duration_ticks: Contract.required(data, "duration_ticks"), notes: notes)
    end

    # Mantém início absoluto da região e início relativo de cada nota.
    def to_h
      { "id" => id, "start_tick" => start_tick, "duration_ticks" => duration_ticks,
        "notes" => notes.map(&:to_h) }
    end
  end
end
