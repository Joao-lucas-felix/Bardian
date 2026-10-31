# frozen_string_literal: true

module Music
  # Representa um evento MIDI relativo ao início da região, sem fixar grafia tonal.
  class NoteEvent
    attr_reader :id, :pitch, :onset_tick, :duration_ticks, :velocity

    # Recebe altura MIDI, início e duração em ticks, e intensidade de 1 a 127.
    def initialize(id:, pitch:, onset_tick:, duration_ticks:, velocity:)
      @id = Contract.label(id, "id")
      @pitch = Contract.integer(pitch, "pitch", min: 0, max: 127)
      @onset_tick = Contract.integer(onset_tick, "onset_tick", min: 0)
      @duration_ticks = Contract.integer(duration_ticks, "duration_ticks", min: 1)
      @velocity = Contract.integer(velocity, "velocity", min: 1, max: 127)
      freeze
    end

    # Constrói o evento a partir do formato com chaves textuais usado em JSON.
    def self.from_h(data)
      new(id: Contract.required(data, "id"), pitch: Contract.required(data, "pitch"),
        onset_tick: Contract.required(data, "onset_tick"),
        duration_ticks: Contract.required(data, "duration_ticks"),
        velocity: Contract.required(data, "velocity"))
    end

    # Devolve dados independentes para serialização e reconstrução posterior.
    def to_h
      { "id" => id, "pitch" => pitch, "onset_tick" => onset_tick,
        "duration_ticks" => duration_ticks, "velocity" => velocity }
    end
  end
end
