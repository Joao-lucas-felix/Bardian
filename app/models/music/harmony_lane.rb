# frozen_string_literal: true

module Music
  # Interpreta a única faixa MIDI de harmonia sem manter uma lista paralela de acordes.
  class HarmonyLane
    BEAT_TICKS = Composition::TICKS_PER_QUARTER
    MAX_CHORDS = 32
    DURATIONS = [ 240, 480, 960, 1920 ].freeze

    attr_reader :composition, :field

    # Exige a forma limitada da sessão guiada; não modifica o documento recebido.
    def initialize(composition)
      raise ArgumentError, "composição inválida" unless composition.is_a?(Composition)
      raise ArgumentError, "selecione uma tonalidade" unless composition.context
      raise ArgumentError, "a página usa compasso 4/4" unless composition.time_signature == { "numerator" => 4, "denominator" => 4 }
      raise ArgumentError, "a página usa até duas faixas harmônicas" unless composition.tracks.length.between?(1, 2)

      track = composition.tracks.find { |item| item.id == "harmony-#{composition.id}" } || composition.tracks.first
      composition.tracks.each do |item|
        raise ArgumentError, "a faixa precisa de uma região no início" unless item.regions.one? && item.regions.first.start_tick.zero?
      end
      raise ArgumentError, "bateria não executa acordes tonais" if track.instrument_id == "drums"
      raise ArgumentError, "a faixa precisa de uma região no início" unless track.regions.length == 1 && track.regions.first.start_tick.zero?

      @composition = composition
      @field = HarmonicField.new(composition.context)
      region = track.regions.first
      @notes = region.notes
      @groups = @notes.group_by(&:onset_tick).sort
      @guided = !composition.harmony_blocks.nil? || guided_sequence?(region.duration_ticks)
      freeze
    end

    # Oferece alturas e uma explicação simples para que ouvir e adicionar usem o mesmo acorde.
    def options
      previous_slot = slots.last
      previous = field.degrees.find { |degree| degree.numeral == previous_slot&.fetch("degree", nil) }
      field.degrees.each_with_index.map do |degree, index|
        root = degree.pitch_classes.first
        base = 60 + root
        tension = tension_for(degree, previous)
        { "index" => index, "degree" => degree.numeral, "symbol" => degree.symbol,
          "function" => degree.function, "notes" => degree.note_names,
          "explanation" => explanation_for(degree, tension),
          "chord" => { "root" => degree.note_names.first, "quality" => HarmonyBlock::QUALITIES.key(degree.pitch_classes.map { |pitch| (pitch - root) % 12 }) },
          "pitches" => degree.pitch_classes.map { |pitch_class| base + ((pitch_class - root) % 12) } }
      end
    end

    # Lê as tríades realmente presentes em cada tempo, ignorando a oitava na identificação.
    def slots
      return [] unless guided?

      return declared_slots unless composition.harmony_blocks.nil?
      previous = nil
      @groups.map do |onset, notes|
        classes = notes.map { |note| note.pitch % 12 }.sort
        degree = field.degrees.find { |item| item.pitch_classes.sort == classes }
        tension = tension_for(degree, previous)
        previous = degree
        { "onset_tick" => onset, "duration_ticks" => notes.first.duration_ticks, "degree" => degree&.numeral,
          "symbol" => degree&.symbol, "function" => degree&.function,
          "tension" => tension, "explanation" => explanation_for(degree, tension) }
      end
    end

    # Informa se a projeção permite operações por blocos sem transformar notas.
    def guided?
      @guided
    end

    # O próximo bloco começa no fim real, independentemente da contagem.
    def next_onset_tick
      return composition.harmony_blocks.sum(&:duration_ticks) unless composition.harmony_blocks.nil?
      @notes.empty? ? 0 : composition.tracks.first.regions.first.duration_ticks
    end

    # Impede que a primeira experiência cresça além de oito compassos.
    def can_append?(count)
      raise ArgumentError, "quantidade inválida" unless count.is_a?(Integer) && count.positive?

      guided? && (composition.harmony_blocks || @groups).length + count <= MAX_CHORDS
    end

    # Expõe apenas projeções de leitura para o controller e a interface.
    def to_h
      current_slots = slots
      last = current_slots.last
      can_continue = last && last["degree"] && can_append?(4)
      reason = if !guided?
        "Edição livre: use Editar composição para modificar as notas."
      elsif last && !last["degree"]
        "O último acorde está fora do campo declarado; escolha um acorde da roda para continuar."
      elsif last && !can_append?(4)
        "Não há espaço para mais quatro acordes."
      end
      { "guided" => guided?, "editing_reason" => guided? ? nil : reason,
        "recommended_indices" => recommended_indices(last),
        "options" => options, "slots" => current_slots,
        "next_onset_tick" => next_onset_tick, "can_append" => can_append?(1),
        "can_generate" => current_slots.empty? && can_append?(4),
        "can_continue" => !!can_continue, "continue_reason" => reason }
    end

    private

    # Projeta identidade declarada; notas livres só informam diferenças de realização.
    def declared_slots
      previous = nil
      composition.harmony_blocks.map do |block|
        degree = field.degrees.find { |item| item.symbol == block.symbol }
        tension = tension_for(degree, previous)
        previous = degree
        notes = @notes.select { |note| note.onset_tick >= block.onset_tick && note.onset_tick < block.onset_tick + block.duration_ticks }
        block.to_h.merge("degree" => degree&.numeral, "symbol" => block.symbol,
          "function" => degree&.function, "tension" => tension,
          "explanation" => "Acorde declarado. #{explanation_for(degree, tension)}",
          "notes_edited" => notes.map { |note| note.pitch % 12 }.uniq.sort != block.pitch_classes.sort,
          "empty" => notes.empty?, "crossing" => notes.any? { |note| note.onset_tick + note.duration_ticks > block.onset_tick + block.duration_ticks })
      end
    end

    # Classifica sem rejeitar MIDI válido: pausas e vozes livres não são blocos guiados.
    def guided_sequence?(duration)
      return false if @groups.length > MAX_CHORDS
      return true if @groups.empty?

      expected = 0
      @groups.each do |onset, notes|
        length = notes.first.duration_ticks
        return false unless onset == expected && notes.length == 3 &&
          DURATIONS.include?(length) && notes.all? { |note| note.duration_ticks == length }

        expected += length
      end
      duration == expected
    end

    # Usa a mesma heurística do gerador; sugestões não proíbem outras escolhas.
    def recommended_indices(last)
      return [] unless guided?
      return [ 0 ] unless last
      return [] unless last["function"]

      functions = HarmonyGenerator.following_functions(last["function"])
      options.select { |option| functions.include?(option["function"]) }.map { |option| option["index"] }
    end

    # Traduz função e transição em rótulos qualitativos didáticos.
    def tension_for(degree, previous)
      return "fora do campo" unless degree
      return "resolução" if degree.function == "tonic" && previous&.function == "dominant"

      { "tonic" => "repouso", "predominant" => "preparação", "dominant" => "tensão" }.fetch(degree.function)
    end

    # Explica em linguagem direta a sensação sugerida por cada acorde no contexto atual.
    def explanation_for(degree, tension)
      return "Este acorde usa notas de fora do tom escolhido." unless degree
      return "Depois do acorde anterior, que cria expectativa, este pode dar sensação de chegada e descanso." if tension == "resolução"
      if composition.context.mode == "natural_minor" && degree.numeral == "v"
        return "No menor natural, este acorde cria expectativa sem puxar tão forte para o próximo."
      end

      { "repouso" => "Pode trazer uma sensação de descanso.",
        "preparação" => "Pode preparar a música para mudar.",
        "tensão" => "Pode criar expectativa para o próximo acorde." }.fetch(tension)
    end
  end
end
