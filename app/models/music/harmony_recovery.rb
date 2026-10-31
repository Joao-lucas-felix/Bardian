# frozen_string_literal: true

module Music
  # Propõe uma partição por IDs sem alterar ou gravar a composição legada.
  class HarmonyRecovery
    # Recebe composição validada; contexto e faixa conhecida delimitam a inferência.
    def initialize(composition)
      @composition = composition
    end

    # Retorna candidatos somente quando a sequência e a grafia tonal são únicas.
    def to_h
      return result("not_needed") unless @composition.harmony_blocks.nil?
      track = @composition.tracks.find { |item| item.id == "harmony-#{@composition.id}" } || (@composition.tracks.first if @composition.tracks.one?)
      return result("empty") unless track
      return result("unsupported", "A recuperação requer uma região iniciada em zero.") unless track.regions.one? && track.regions.first.start_tick.zero?
      notes = track.regions.first.notes
      return result("empty") if notes.empty?
      return result("ambiguous", "Declare a tonalidade antes de recuperar.") unless @composition.context
      candidates = []
      field = HarmonicField.new(@composition.context)
      notes.group_by { |note| [ note.onset_tick, note.duration_ticks ] }.each do |(onset, duration), group|
        next unless HarmonyBlock::DURATIONS.include?(duration)
        field.degrees.each do |degree|
          voices = degree.pitch_classes.map { |pitch| group.select { |note| note.pitch % 12 == pitch } }
          next if voices.any?(&:empty?)
          # Duas possibilidades já provam ambiguidade; evita produto cartesiano ilimitado.
          choices = [ voices.map(&:first) ]
          duplicate = voices.index { |voice| voice.length > 1 }
          choices << voices.each_with_index.map { |voice, i| voice[i == duplicate ? 1 : 0] } if duplicate
          choices.each do |trio|
            candidates << { onset: onset, duration: duration, notes: trio,
              chord: { "root" => degree.note_names.first, "quality" => quality(degree) } }
          end
        end
      end
      last_onset = notes.map(&:onset_tick).max
      sequences = []
      visit = lambda do |onset, path|
        return if sequences.length > 1 || path.length > 32
        if onset > last_onset
          sequences << path unless path.empty?
          return
        end
        candidates.select { |candidate| candidate[:onset] == onset }.each do |candidate|
          visit.call(onset + candidate[:duration], path + [ candidate ])
          break if sequences.length > 1
        end
      end
      visit.call(0, [])
      return result("ambiguous", "Declare os acordes e selecione suas notas; não há uma separação única.") unless sequences.one?
      used_ids = [ @composition.id ] + @composition.tracks.flat_map { |item| [ item.id ] + item.regions.flat_map { |region| [ region.id ] + region.notes.map(&:id) } }
      assignments = notes.to_h { |note| [ note.id, "additional" ] }
      blocks = sequences.first.each_with_index.map do |candidate, index|
        id = "recovered-#{index + 1}"
        id += "-block" while used_ids.include?(id)
        used_ids << id
        candidate[:notes].each { |note| assignments[note.id] = "realization" }
        { "id" => id, "onset_tick" => candidate[:onset], "duration_ticks" => candidate[:duration], "chord" => candidate[:chord] }
      end
      { "status" => "candidate", "blocks" => blocks, "assignments" => assignments, "reason" => nil }
    end

    private

    # O campo já construiu a tríade; a qualidade é obtida dos intervalos relativos.
    def quality(degree)
      offsets = degree.pitch_classes.map { |pitch| (pitch - degree.pitch_classes.first) % 12 }
      HarmonyBlock::QUALITIES.key(offsets)
    end

    # Forma estável para estados sem proposta, consumida pelo formulário de recuperação.
    def result(status, reason = nil)
      { "status" => status, "blocks" => [], "assignments" => {}, "reason" => reason }
    end
  end
end
