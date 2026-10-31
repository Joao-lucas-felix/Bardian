require "test_helper"

# Verifica persistência, isolamento de contas e conservação de faixas fora da harmonia.
class CompositionHarmoniesControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  # Cada cenário recebe uma composição real no banco de teste.
  setup do
    @owner = User.create!(email: "harmony-owner@example.com", password: "senha-segura")
    id = SecureRandom.uuid
    @composition = @owner.compositions.create!(id: id, document: {
      "version" => 1, "id" => id, "name" => "Minha música", "bpm" => 120,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "tracks" => [] })
    sign_in @owner
  end

  # A próxima etapa deve abrir o editor completo, mantendo navegação e shell de áudio.
  test "abre piano roll diretamente e mostra proximo passo" do
    get composition_harmony_path(@composition, panel: "editor")
    assert_response :success
    assert_select "turbo-frame#harmony-panel[data-panel='editor'] section.harmony-editor-panel"
    assert_select "a[href='#{next_step_composition_path(@composition)}']", text: /Próximo passo/
  end

  test "abre sem gravar e entrega isolamento apenas na pagina de audio" do
    assert_no_changes -> { @composition.reload.document } do
      get composition_harmony_path(@composition)
      assert_response :success
    end
    assert_equal "same-origin", response.headers["Cross-Origin-Opener-Policy"]
    assert_equal "require-corp", response.headers["Cross-Origin-Embedder-Policy"]
    assert_select "[data-harmony-save-url-value='#{composition_harmony_path(@composition)}']"
    assert_select "meta[name='turbo-visit-control'][content='reload']"
    assert_select 'html[data-theme="dark"]'
    assert_select '.harmony-toolbar [data-harmony-target="playbackMeter"][data-state="stopped"] svg[aria-hidden="true"]'
    get composition_path(@composition)
    assert_response :success
    assert_nil response.headers["Cross-Origin-Opener-Policy"]
    assert_select "a[href='#{composition_harmony_path(@composition)}'][data-turbo='false']"
    assert_select "a[href='#{composition_harmony_path(@composition)}']", text: /Escrever harmonia/
  end

  # Confirma que o GET da interface entrega explicações prontas para a seleção.
  test "pagina entrega explicacao simples para cada acorde disponivel" do
    get composition_harmony_path(@composition)

    assert_response :success
    state_value = Nokogiri::HTML(response.body).at_css("[data-harmony-state-value]")["data-harmony-state-value"]
    state = JSON.parse(state_value)
    assert_equal 7, state.fetch("options").length
    assert state.fetch("options").all? { |option| option.fetch("explanation").present? }
    assert_select ".harmony-chord[aria-label^='Ouvir C. Pode trazer uma sensação de descanso.']"
  end

  test "salva reabre e preserva faixa e loop existentes" do
    other = { "id" => "melody", "name" => "Melodia", "instrument_id" => "piano",
      "volume" => 1, "mute" => false, "solo" => false,
      "regions" => [ { "id" => "other-region", "start_tick" => 0, "duration_ticks" => 960,
        "notes" => [ { "id" => "other-note", "pitch" => 72, "onset_tick" => 0, "duration_ticks" => 960, "velocity" => 80 } ] } ] }
    @composition.update!(document: @composition.document.merge("tracks" => [ other ], "loop" => { "start_tick" => 0, "end_tick" => 1920 }))
    payload = draft
    payload["bpm"] = 96
    payload["tracks"][0]["regions"][0]["notes"] = [ 60, 64, 67 ].each_with_index.map do |pitch, index|
      { "id" => "note-#{index}", "pitch" => pitch, "onset_tick" => 0, "duration_ticks" => 480, "velocity" => 90 }
    end
    patch composition_harmony_path(@composition), params: { document: payload, lock_version: @composition.lock_version }, as: :json
    assert_response :success
    assert_equal 2, @composition.reload.document["tracks"].length
    assert_equal other, @composition.document["tracks"][0]
    assert_equal({ "start_tick" => 0, "end_tick" => 1920 }, @composition.document["loop"])
    assert_equal payload, CompositionHarmony.new(@composition.document).document
    get composition_harmony_path(@composition)
    assert_response :success
    assert_select "[data-harmony-lock-version-value='#{@composition.lock_version}']"
  end

  test "rejeita conflito identidade e nota invalidos sem sobrescrever" do
    payload = draft
    @composition.update!(document: @composition.document.merge("name" => "Atualizada"))
    patch composition_harmony_path(@composition), params: { document: payload, lock_version: 0 }, as: :json
    assert_response :conflict
    payload["id"] = "outra"
    patch composition_harmony_path(@composition), params: { document: payload, lock_version: @composition.lock_version }, as: :json
    assert_response :unprocessable_entity
    assert_equal [], @composition.reload.document["tracks"]
    assert_equal "Atualizada", @composition.name
  end

  test "analise nao persiste e outras contas nao acessam nenhum endpoint" do
    assert_no_changes -> { @composition.reload.document } do
      post assist_composition_harmony_path(@composition), params: { document: draft, operation: "generate" }, as: :json
      assert_response :success
      assert_equal 4, response.parsed_body["preview"].length
    end
    sign_out @owner
    sign_in User.create!(email: "harmony-other@example.com", password: "senha-segura")
    # Consolida a nova sessão antes de exercitar respostas de exceção (404).
    get compositions_path
    assert_response :success
    get composition_harmony_path(@composition)
    assert_response :not_found
    patch composition_harmony_path(@composition), params: { document: draft, lock_version: 0 }, as: :json
    assert_response :not_found
    post assist_composition_harmony_path(@composition), params: { document: draft, operation: "analyze" }, as: :json
    assert_response :not_found
  end

  test "salva notas livres e reabre sem exigir triades" do
    payload = draft
    payload["tracks"][0]["regions"][0]["notes"] = [
      { "id" => "free", "pitch" => 63, "onset_tick" => 17, "duration_ticks" => 291, "velocity" => 80 }
    ]
    patch composition_harmony_path(@composition), params: { document: payload, lock_version: 0 }, as: :json
    assert_response :success
    assert_equal payload, CompositionHarmony.new(@composition.reload.document).document
    get composition_harmony_path(@composition)
    assert_response :success
    post assist_composition_harmony_path(@composition), params: { document: payload, operation: "analyze" }, as: :json
    assert_response :success
    assert_equal false, response.parsed_body["state"]["guided"]
  end

  test "persiste timbres locais e rejeita timbre desconhecido" do
    %w[synth harmony_pad harmony_pluck harmony_organ].each do |instrument|
      payload = draft
      payload["tracks"][0]["instrument_id"] = instrument
      patch composition_harmony_path(@composition), params: { document: payload, lock_version: @composition.reload.lock_version }, as: :json
      assert_response :success
      assert_equal instrument, @composition.reload.document["tracks"][0]["instrument_id"]
    end
    payload = draft
    payload["tracks"][0]["instrument_id"] = "unknown"
    patch composition_harmony_path(@composition), params: { document: payload, lock_version: @composition.lock_version }, as: :json
    assert_response :unprocessable_entity
  end

  test "paineis autorizados nao carregam copia obsoleta de notas" do
    get composition_harmony_path(@composition)
    assert_select "turbo-frame#harmony-panel"
    assert_select "select[data-harmony-target='instrument'] option", count: 15
    assert_select "option[value=fluid_vibraphone]", text: "Vibrafone · lo-fi"
    %w[guided settings editor].each do |panel|
      get "/compositions/#{@composition.id}/harmony/panel", params: { panel: panel }
      assert_response :success
      assert_select "turbo-frame#harmony-panel"
      assert_select "[data-harmony-document-value]", count: 0
    end
    get "/compositions/#{@composition.id}/harmony/panel", params: { panel: "../../layouts/application" }
    assert_response :unprocessable_entity
    sign_out @owner
    sign_in User.create!(email: "panel-other@example.com", password: "senha-segura")
    get compositions_path
    get "/compositions/#{@composition.id}/harmony/panel", params: { panel: "editor" }
    assert_response :not_found
  end

  test "menu troca a área completa entre harmonia ajustes e piano roll" do
    get composition_harmony_path(@composition)

    assert_response :success
    assert_select "nav.harmony-panel-nav a", text: "Piano roll"
    assert_select "turbo-frame#harmony-panel[data-panel='guided'] #harmony-wheel-title", text: "Ouça e escolha"
    assert_select "turbo-frame#harmony-panel[data-panel='guided'] #harmony-lane-title", text: "Sua sequência"
    assert_select "turbo-frame#harmony-panel[data-panel='guided'] select[data-harmony-target='duration']"
    assert_select "nav.harmony-panel-nav a[aria-current='page']", text: "Harmonia"
    assert_select ".harmony-workspace-controls", count: 0
    assert_select ".harmony-piano-panel", count: 0
    assert_select ".harmony-recovery-summary a[data-turbo='true'][data-turbo-frame='harmony-panel']"

    get "/compositions/#{@composition.id}/harmony/panel", params: { panel: "settings" }
    assert_response :success
    assert_select "section.harmony-settings-panel"
    assert_select "#harmony-wheel-title", count: 0
    assert_select "#harmony-lane-title", count: 0

    get "/compositions/#{@composition.id}/harmony/panel", params: { panel: "editor" }
    assert_response :success
    assert_select "section.harmony-editor-panel"
    assert_select "template [data-controller='piano-roll']"
    assert_select "template button[data-piano-roll-target='expandButton'][aria-expanded='false']", text: "Expandir"
    assert_select "#harmony-wheel-title", count: 0
    assert_select "section.harmony-recovery", count: 0
  end

  test "painel de ajustes contem recuperacao sem gravar ao abrir" do
    assert_no_changes -> { @composition.reload.document } do
      get "/compositions/#{@composition.id}/harmony/panel", params: { panel: "settings" }

      assert_response :success
      assert_select "section.harmony-recovery"
      assert_select "[data-harmony-target='recoveryBlocks']"
      assert_select "button", text: "Confirmar separação"
    end
  end

  private

  # Projeta o mesmo documento que será enviado ao browser, sem simular regra musical.
  def draft
    CompositionHarmony.new(@composition.document).document
  end
end
