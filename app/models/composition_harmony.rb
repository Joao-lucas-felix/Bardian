# Projeta a faixa guiada sobre o documento salvo e preserva as demais faixas.
class CompositionHarmony
  # Recebe o documento completo; não grava nem altera o hash de entrada.
  def initialize(document)
    @document = document.deep_dup
    @track_id = "harmony-#{@document.fetch('id')}"
  end

  # Retorna uma composição de uma faixa aceita por HarmonyLane, criando-a em memória.
  def document
    projected = @document.deep_dup
    projected["context"] ||= { "tonic" => "C", "mode" => "major" }
    projected.delete("loop")
    projected["tracks"] = [ @document.fetch("tracks").find { |track| track["id"] == @track_id } || empty_track ]
    extra = @document.fetch("tracks").find { |track| track["id"] == "harmony-extra-#{@document.fetch('id')}" }
    projected["tracks"] << extra if extra
    Music::HarmonyLane.new(Music::Composition.from_h(projected))
    projected
  end

  # Valida a projeção recebida antes de mesclar; a versão é conferida no controller.
  def merge(input)
    # Comparar com a forma canônica impede perda silenciosa de extensões desconhecidas.
    [ @document, input ].each do |data|
      raise ArgumentError, "campos desconhecidos no documento" unless Music::Composition.from_h(data).to_h == data
    end
    music = Music::Composition.from_h(input)
    Music::HarmonyLane.new(music)
    allowed = [ @track_id, "harmony-extra-#{@document.fetch('id')}" ]
    raise ArgumentError, "identidade da harmonia inválida" unless music.id == @document["id"] && music.tracks.any? { |track| track.id == @track_id } && music.tracks.all? { |track| allowed.include?(track.id) }
    raise ArgumentError, "o compasso da composição mudou" unless music.time_signature == @document["time_signature"]
    raise ArgumentError, "instrumento indisponível" unless music.tracks.all? { |track| HarmonyInstrumentCatalog.include?(track.instrument_id) }
    extra = @document.fetch("tracks").find { |track| track["id"] == allowed.last }
    if extra && extra["regions"].any? { |region| region["notes"].any? } && music.tracks.none? { |track| track.id == allowed.last }
      raise ArgumentError, "a faixa adicional com notas não pode ser omitida"
    end
    unless music.harmony_blocks.nil?
      realization = music.tracks.find { |track| track.id == @track_id }
      realization.regions.first.notes.each do |note|
        raise ArgumentError, "início de nota fora dos blocos" unless music.harmony_blocks.any? { |block| note.onset_tick >= block.onset_tick && note.onset_tick < block.onset_tick + block.duration_ticks }
      end
    end
    result = @document.deep_dup
    result["context"] = music.context.to_h
    result["bpm"] = music.bpm
    if music.harmony_blocks.nil?
      raise ArgumentError, "a declaração harmônica não pode ser omitida" if @document.key?("harmony")
    else
      result["harmony"] = { "blocks" => music.harmony_blocks.map(&:to_h) }
    end
    music.tracks.each do |track|
      index = result["tracks"].index { |item| item["id"] == track.id }
      index ? result["tracks"][index] = track.to_h : result["tracks"] << track.to_h
    end
    Music::Composition.from_h(result).to_h
  end

  private

  # Identidades determinísticas permitem recarregar um rascunho vazio sem gravar no GET.
  def empty_track
    { "id" => @track_id, "name" => "Harmonia", "instrument_id" => "synth",
      "volume" => 0.7, "mute" => false, "solo" => false,
      "regions" => [ { "id" => "region-#{@track_id}", "start_tick" => 0,
        "duration_ticks" => 480, "notes" => [] } ] }
  end
end
