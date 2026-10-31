require "test_helper"

# Exercita a página pública sem associar o rascunho a uma conta ou ao banco.
class HarmonyControllerTest < ActionDispatch::IntegrationTest
  test "visitante abre exemplo de do maior sem criar composicao" do
    assert_no_difference("Composition.count") do
      get harmony_path
      assert_response :success
    end
    assert_select "[data-harmony-context='C major']"
    assert_match(/temporária|recarregar/i, response.body)
  end

  test "pagina separa roda faixa e previa em controles acessiveis" do
    get harmony_path
    assert_response :success
    assert_select "[data-controller='harmony'][data-harmony-document-value]"
    assert_select "[data-harmony-target='wheel'] button[data-action='click->harmony#selectChord']", 7
    assert_select "select[data-harmony-target='tonic'] option[value='C'][selected]"
    assert_select "select[data-harmony-target='mode'] option[value='major'][selected]"
    assert_select "select[data-harmony-target='instrument'] option[value='drums']", 0
    assert_select "[data-harmony-target='lane'] [data-beat]", 4
    %w[applySelected play removeSelected generate continue applyPreview playPreview].each do |action|
      assert_select "[data-action='click->harmony##{action}']"
    end
    assert_select "[data-harmony-target='status'][role='status'][aria-live='polite']"
    assert_select "details.harmony-settings:not([open])"
    assert_select "details.harmony-suggestions:not([open])"
    assert_select "details.harmony-piano-panel:not([open])"
    assert_select "[data-harmony-target='lane'][tabindex='0'][role='region']"
    assert_match(/recarregar.*perde|perde.*recarregar/i, response.body)
  end

  test "analisa documento atual e entrega sete acordes sem gravar" do
    input = document
    assert_no_difference("Composition.count") do
      post assist_harmony_path, params: { document: input, operation: "analyze" }, as: :json
      assert_response :success
    end
    state = response.parsed_body.fetch("state")
    assert_equal 7, state.fetch("options").length
    assert_equal 0, state.fetch("next_onset_tick")
    assert_nil response.parsed_body.fetch("preview")
    assert_equal [], input.dig(:tracks, 0, :regions, 0, :notes)
  end

  test "gera e continua somente como previa" do
    post assist_harmony_path, params: { document: document, operation: "generate" }, as: :json
    assert_response :success
    assert_equal [ 0, 480, 960, 1440 ], response.parsed_body.fetch("preview").map { |item| item.fetch("onset_tick") }

    with_c = document
    with_c[:tracks][0][:regions][0][:notes] = notes_for(0, "first", [ 60, 64, 67 ])
    post assist_harmony_path, params: { document: with_c, operation: "continue" }, as: :json
    assert_response :success
    assert_equal 480, response.parsed_body.fetch("preview").first.fetch("onset_tick")
    assert_equal 3, with_c.dig(:tracks, 0, :regions, 0, :notes).length
  end

  test "rejeita estrutura operacao e limite invalidos sem persistir" do
    malformed = document.merge(version: 2)
    drums = document
    drums[:tracks][0][:instrument_id] = "drums"
    two_tracks = document
    two_tracks[:tracks] << Marshal.load(Marshal.dump(two_tracks[:tracks][0])).merge(id: "other")
    offbeat = document
    offbeat[:tracks][0][:regions][0][:duration_ticks] = 600
    offbeat[:tracks][0][:regions][0][:notes] = notes_for(120, "off", [ 60, 64, 67 ])
    extra_space = document
    extra_space[:tracks][0][:regions][0][:duration_ticks] = 960
    full = document
    full[:tracks][0][:regions][0][:duration_ticks] = 32 * 480
    full[:tracks][0][:regions][0][:notes] = 32.times.flat_map { |index| notes_for(index * 480, "#{index}", [ 60, 64, 67 ]) }

    [ [ malformed, "analyze" ], [ drums, "analyze" ], [ two_tracks, "analyze" ],
      [ offbeat, "continue" ], [ document, "unknown" ], [ full, "continue" ] ].each do |input, operation|
      before = Marshal.load(Marshal.dump(input))
      assert_no_difference("Composition.count") do
        post assist_harmony_path, params: { document: input, operation: operation }, as: :json
        assert_response :unprocessable_entity
      end
      assert response.parsed_body.fetch("error").present?
      assert_equal before, input
    end
  end

  private

  # Retorna o mesmo contrato versão 1 do editor, com uma faixa e região vazias.
  def document
    { version: 1, id: "draft", name: "Harmonia guiada", bpm: 120,
      time_signature: { numerator: 4, denominator: 4 },
      context: { tonic: "C", mode: "major" },
      tracks: [ { id: "harmony", name: "Harmonia", instrument_id: "piano",
        volume: 1, mute: false, solo: false,
        regions: [ { id: "region", start_tick: 0, duration_ticks: 480, notes: [] } ] } ] }
  end

  # Produz um acorde de três eventos independentes na posição solicitada.
  def notes_for(onset, prefix, pitches)
    pitches.each_with_index.map do |pitch, index|
      { id: "#{prefix}-#{index}", pitch: pitch, onset_tick: onset,
        duration_ticks: 480, velocity: 90 }
    end
  end
end
