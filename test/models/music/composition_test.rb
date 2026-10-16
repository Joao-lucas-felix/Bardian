require "test_helper"
require "json"

# Verifica o contrato musical que será compartilhado com persistência e editor.
class MusicCompositionTest < ActiveSupport::TestCase
  # Uma composição vazia precisa sobreviver ao transporte em JSON sem inventar faixas.
  test "reconstroi uma composicao vazia apos serializacao" do
    source = { "version" => 1, "id" => "song-1", "name" => "Ideia", "bpm" => 96,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "tracks" => [] }

    composition = Music::Composition.from_h(JSON.parse(JSON.generate(source)))

    assert_equal source, composition.to_h
    assert_equal source, Music::Composition.from_h(JSON.parse(JSON.generate(composition.to_h))).to_h
  end

  # Deslocar uma região não deve alterar os tempos locais das notas nem a ordem das faixas.
  test "preserva faixas, regioes simultaneas e notas em um round trip" do
    source = composition_data
    copy = Music::Composition.from_h(JSON.parse(JSON.generate(source)))

    assert_equal source, copy.to_h
    assert_equal [ 0, 0 ], copy.tracks.map { |track| track.regions.first.start_tick }
    assert_equal 480, copy.tracks.first.regions.first.notes.last.onset_tick
    assert_equal 480, copy.ticks_per_beat
  end

  # O contrato não pode depender da mutabilidade do JSON usado na construção.
  test "protege estado interno de mutacoes da entrada e da saida" do
    source = composition_data
    composition = Music::Composition.from_h(source)
    source["tracks"][0]["regions"][0]["notes"][0]["pitch"] = 72
    exported = composition.to_h
    exported["tracks"][0]["name"] = "Outro"

    assert_equal 60, composition.tracks.first.regions.first.notes.first.pitch
    assert_equal "Harmonia", composition.tracks.first.name
    assert_raises(FrozenError) { composition.tracks.clear }
  end

  # Eventos MIDI fora dos limites ou além da região quebrariam edição e reprodução.
  test "rejeita notas midi ou tempos invalidos" do
    [ -1, 128, 60.5 ].each do |pitch|
      assert_invalid_note("pitch" => pitch)
    end
    [ 0, 128, "100" ].each do |velocity|
      assert_invalid_note("velocity" => velocity)
    end
    assert_invalid_note("onset_tick" => -1)
    assert_invalid_note("duration_ticks" => 0)
    assert_invalid_note("onset_tick" => 1800, "duration_ticks" => 240)
  end

  # IDs duplicados impediriam seleção, edição e salvamento inequívocos.
  test "rejeita ids repetidos mesmo entre faixas" do
    source = composition_data
    source["tracks"][1]["id"] = "track-1"
    assert_raises(ArgumentError) { Music::Composition.from_h(source) }

    source = composition_data
    source["tracks"][1]["regions"][0]["notes"][0]["id"] = "note-1"
    assert_raises(ArgumentError) { Music::Composition.from_h(source) }
  end

  # Métrica inválida, BPM nulo e formato desconhecido não devem entrar no domínio.
  test "rejeita metadados temporais e versao invalidos" do
    { "bpm" => 0, "time_signature" => { "numerator" => 0, "denominator" => 4 },
      "version" => 2 }.each do |field, value|
      source = composition_data
      source[field] = value
      assert_raises(ArgumentError) { Music::Composition.from_h(source) }
    end
  end

  # Uma região sem notas é uma edição legítima e deve permanecer representável.
  test "aceita regiao vazia e rejeita duracao nula" do
    source = composition_data
    source["tracks"][0]["regions"][0]["notes"] = []
    assert_empty Music::Composition.from_h(source).tracks.first.regions.first.notes
    source["tracks"][0]["regions"][0]["duration_ticks"] = 0
    assert_raises(ArgumentError) { Music::Composition.from_h(source) }
  end

  # A unidade base não muda com o compasso: colcheias têm metade dos ticks.
  test "calcula batidas em compasso de oito sem mudar a semínima" do
    source = composition_data
    source["time_signature"] = { "numerator" => 6, "denominator" => 8 }

    composition = Music::Composition.from_h(source)

    assert_equal 240, composition.ticks_per_beat
    assert_equal source["time_signature"], composition.to_h["time_signature"]
  end

  # Valores de controle inválidos não podem chegar ao futuro motor de áudio.
  test "rejeita volume, mute e colecoes invalidas" do
    { "volume" => 1.5, "mute" => "false", "regions" => {} }.each do |field, value|
      source = composition_data
      source["tracks"][0][field] = value
      assert_raises(ArgumentError) { Music::Composition.from_h(source) }
    end
  end

  # Um payload parcial precisa falhar claramente antes de virar estado musical.
  test "rejeita campo obrigatorio ausente" do
    source = composition_data
    source["tracks"][0]["regions"][0]["notes"][0].delete("velocity")

    assert_raises(ArgumentError) { Music::Composition.from_h(source) }
  end

  # Números que JSON não representa de forma musicalmente útil falham com erro de validação.
  test "rejeita andamento nao finito ou complexo" do
    [ Float::INFINITY, Float::NAN, Complex(1, 2) ].each do |bpm|
      source = composition_data
      source["bpm"] = bpm
      assert_raises(ArgumentError) { Music::Composition.from_h(source) }
    end
  end

  private

  # Monta duas faixas no mesmo instante para capturar perda de ordem ou sobreposição.
  def composition_data
    { "version" => 1, "id" => "song-1", "name" => "Ideia", "bpm" => 96,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "tracks" => [
        { "id" => "track-1", "name" => "Harmonia", "instrument_id" => "piano", "volume" => 0.8,
          "mute" => false, "solo" => false, "regions" => [
            { "id" => "region-1", "start_tick" => 0, "duration_ticks" => 1920, "notes" => [
              { "id" => "note-1", "pitch" => 60, "onset_tick" => 0, "duration_ticks" => 480, "velocity" => 100 },
              { "id" => "note-2", "pitch" => 64, "onset_tick" => 480, "duration_ticks" => 480, "velocity" => 90 }
            ] }
          ] },
        { "id" => "track-2", "name" => "Melodia", "instrument_id" => "strings", "volume" => 1.0,
          "mute" => false, "solo" => false, "regions" => [
            { "id" => "region-2", "start_tick" => 0, "duration_ticks" => 960, "notes" => [
              { "id" => "note-3", "pitch" => 72, "onset_tick" => 0, "duration_ticks" => 960, "velocity" => 110 }
            ] }
          ] }
      ] }
  end

  # Substitui um campo da primeira nota e exige falha na entrada do contrato.
  def assert_invalid_note(changes)
    source = composition_data
    source["tracks"][0]["regions"][0]["notes"][0].merge!(changes)
    assert_raises(ArgumentError) { Music::Composition.from_h(source) }
  end
end
