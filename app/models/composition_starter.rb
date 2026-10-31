# Prepara propostas harmônicas e reconstrói a escolha no documento musical inicial.
class CompositionStarter
  PREVIEW_COUNT = 3
  PREVIEW_LENGTH = Music::HarmonyGenerator::COUNT

  # Recebe as configurações do formulário e valida seus limites antes de gerar áudio ou notas.
  def initialize(id:, name:, bpm:, tonic:, mode:, instrument:, random: Random.new)
    @id = id
    @name = name.to_s.strip.presence || "Sem título"
    @bpm = Integer(bpm, exception: false)
    raise ArgumentError, "BPM deve ficar entre 30 e 240" unless @bpm&.between?(30, 240)

    @context = Music::MusicalContext.new(tonic: tonic, mode: mode)
    @instrument = instrument
    raise ArgumentError, "instrumento indisponível" unless HarmonyInstrumentCatalog.include?(@instrument)
    @random = random
  end

  # Gera propostas transitórias com a mesma heurística usada no editor de harmonia.
  def preview(count: PREVIEW_COUNT)
    raise ArgumentError, "quantidade de propostas inválida" unless count.is_a?(Integer) && count.between?(1, PREVIEW_COUNT)

    lane = Music::HarmonyLane.new(Music::Composition.from_h(document))
    Array.new(count) { Music::HarmonyGenerator.new(lane, random: @random).preview(mode: :generate) }
  end

  # Constrói a faixa e, quando houver escolha, suas quatro tríades em tempos consecutivos.
  # `degrees` é a sequência de índices mostrada na prévia; alturas são refeitas pelo domínio.
  def document(degrees: nil)
    notes = []
    blocks = []
    if degrees.present?
      raise ArgumentError, "prévia selecionada inválida" unless degrees.is_a?(String) && degrees.match?(/\A[0-6](,[0-6]){3}\z/)
      indices = degrees.split(",").map(&:to_i)
      raise ArgumentError, "a prévia deve começar pela tônica" unless indices.first.zero?

      options = Music::HarmonyLane.new(Music::Composition.from_h(base_document)).options
      selected = indices.map { |degree| options.fetch(degree) }
      notes = selected.each_with_index.flat_map do |option, beat|
        option.fetch("pitches").map do |pitch|
          { "id" => SecureRandom.uuid, "pitch" => pitch, "onset_tick" => beat * 480,
            "duration_ticks" => 480, "velocity" => 90 }
        end
      end
      blocks = selected.each_with_index.map do |option, beat|
        { "id" => SecureRandom.uuid, "onset_tick" => beat * 480, "duration_ticks" => 480,
          "chord" => option.fetch("chord") }
      end
    end
    data = base_document
    data["tracks"][0]["regions"][0]["notes"] = notes
    data["tracks"][0]["regions"][0]["duration_ticks"] = notes.empty? ? 480 : 1920
    data["harmony"] = { "blocks" => blocks }
    Music::Composition.from_h(data).to_h
  end

  private

  # A faixa vazia fornece ao gerador e à página guiada o mesmo contrato de entrada.
  def base_document
    track_id = "harmony-#{@id}"
    { "version" => Music::Composition::VERSION, "id" => @id, "name" => @name, "bpm" => @bpm,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "context" => @context.to_h,
      "tracks" => [ { "id" => track_id, "name" => "Harmonia", "instrument_id" => @instrument,
        "volume" => 0.7, "mute" => false, "solo" => false,
        "regions" => [ { "id" => "region-#{track_id}", "start_tick" => 0,
          "duration_ticks" => 480, "notes" => [] } ] } ] }
  end
end
