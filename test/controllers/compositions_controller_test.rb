require "test_helper"

# Exercita o CRUD de composições com autenticação, validação e controle de versão.
class CompositionsControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  # A prévia consulta o domínio sem criar composição ou gravar uma escolha.
  test "gera previas sem persistir e cria a escolha recebida" do
    sign_in user
    assert_no_difference("Composition.count") do
      post preview_compositions_path, params: { composition: { bpm: 90, tonic: "D", mode: "major", instrument: "synth" } }, as: :json
      assert_response :success
      assert_equal 3, response.parsed_body.fetch("previews").length
      assert_equal "D", response.parsed_body.fetch("previews").first.first.fetch("symbol")
    end

    assert_difference("Composition.count", 1) do
      post compositions_path, params: { composition: { name: "Ideia", bpm: 90, tonic: "C", mode: "major",
        instrument: "synth", preview_degrees: "0,3,4,0" } }
    end
    composition = user.compositions.order(:created_at).last
    assert_equal 12, composition.document.dig("tracks", 0, "regions", 0, "notes").length
    assert_equal "C", composition.document.dig("context", "tonic")
    assert_redirected_to composition_harmony_path(composition)
  end

  # Dados adulterados não devem criar um documento parcialmente válido.
  test "rejeita escolha ou contexto invalido na criacao" do
    sign_in user
    assert_no_difference("Composition.count") do
      post compositions_path, params: { composition: { name: "Ideia", bpm: 90, tonic: "C", mode: "major",
        instrument: "synth", preview_degrees: "0,7,4,0" } }
      assert_response :unprocessable_entity
      assert_select "input[name='composition[name]'][value='Ideia']"
      assert_select "[role='alert']", text: /prévia selecionada inválida/
    end
    assert_no_difference("Composition.count") do
      post compositions_path, params: { composition: { name: "Ideia", bpm: 90, tonic: "C", mode: "major",
        instrument: "synth", preview_degrees: [ "0", "3", "4", "0" ] } }
      assert_response :unprocessable_entity
    end
  end

  # A criação expõe controles iniciais, seleção opcional e retorno legível da prévia.
  test "formulario apresenta primeiros sons e permite criar sem acordes" do
    sign_in user
    get new_composition_path
    assert_response :success
    assert_select "section[aria-label='Primeiros sons']", count: 0
    assert_select "input[name='composition[name]']"
    assert_select "input[name='composition[cover]']"

    post compositions_path, params: { composition: { name: "Sem acordes" } }
    composition = user.compositions.order(:created_at).last
    assert_redirected_to setup_composition_path(composition)
    assert_equal [], composition.document.fetch("tracks")

    get setup_composition_path(composition)
    assert_response :success
    assert_select ".flash-notice[data-controller='flash'][data-flash-auto-dismiss-value='true']"
    assert_select ".flash-notice button[data-action='flash#dismiss'][aria-label='Fechar notificação']"
    assert_select "a[href='#{edit_composition_path(composition, return_to: 'setup')}']", text: /Voltar aos dados/
    assert_select "section[aria-label='Primeiros sons']"
    assert_select "select[name='composition[tonic]']"
    assert_select "select[name='composition[mode]']"
    assert_select "select[name='composition[instrument]']"
    assert_select "input[name='composition[preview_degrees]']"
    assert_select "a[href='#{composition_harmony_path(composition)}']", text: /Pular por enquanto/

    get composition_harmony_path(composition)
    assert_response :success
    assert_equal [], composition.reload.document.fetch("tracks")

    patch configure_composition_path(composition), params: { lock_version: composition.lock_version, composition: { bpm: 100,
      tonic: "A", mode: "natural_minor", instrument: "synth" } }
    assert_redirected_to composition_harmony_path(composition)
    assert_equal [], composition.reload.document.dig("tracks", 0, "regions", 0, "notes")
    assert_equal "A", composition.document.dig("context", "tonic")
  end

  # Voltar à primeira etapa deve permitir corrigir nome/capa e retornar aos controles.
  test "edicao de metadados retorna a configuracao inicial" do
    sign_in user
    post compositions_path, params: { composition: { name: "Rascunho" } }
    composition = user.compositions.order(:created_at).last
    get edit_composition_path(composition, return_to: "setup")
    assert_response :success
    assert_select "input[name='return_to'][value='setup']"
    assert_select "a[href='#{setup_composition_path(composition)}']", text: /Voltar aos primeiros sons/
    assert_select "a[href='#{setup_composition_path(composition)}']", text: /Cancelar/

    patch composition_path(composition), params: { lock_version: composition.lock_version,
      return_to: "setup", composition: { name: "Novo nome" } }
    assert_redirected_to setup_composition_path(composition)
    assert_equal "Novo nome", composition.reload.name
  end

  # Configurar uma proposta exige documento vazio e não pode substituir música existente.
  test "configuracao valida entrada e protege a composicao existente" do
    sign_in user
    post compositions_path, params: { composition: { name: "Rascunho" } }
    composition = user.compositions.order(:created_at).last

    patch configure_composition_path(composition), params: { lock_version: composition.lock_version, composition: { bpm: 999,
      tonic: "C", mode: "major", instrument: "synth", preview_degrees: "0,3,4,0" } }
    assert_response :unprocessable_entity
    assert_equal [], composition.reload.document.fetch("tracks")

    patch configure_composition_path(composition), params: { lock_version: composition.lock_version, composition: { bpm: 90,
      tonic: "C", mode: "major", instrument: "synth", preview_degrees: "0,3,4,0" } }
    assert_redirected_to composition_harmony_path(composition)
    assert_equal 12, composition.reload.document.dig("tracks", 0, "regions", 0, "notes").length

    patch configure_composition_path(composition), params: { composition: { bpm: 100,
      tonic: "D", mode: "major", instrument: "synth" } }
    assert_response :conflict
    assert_equal "C", composition.reload.document.dig("context", "tonic")

    sign_out user
    other = User.create!(email: "starter-other@example.com", password: "senha-segura")
    sign_in other
    get setup_composition_path(composition)
    assert_response :not_found
    sign_in other
    patch configure_composition_path(composition), params: { composition: { bpm: 100,
      tonic: "D", mode: "major", instrument: "synth" } }
    assert_response :not_found
  end

  # O próximo passo pertence ao autor e apresenta somente o editor existente como ação.
  test "proximo passo mostra escolhas e protege composicao alheia" do
    sign_in user
    composition = saved_composition
    get next_step_composition_path(composition)
    assert_response :success
    assert_select "h1", text: /próximo passo/i
    assert_select "a[href='#{composition_harmony_path(composition, panel: 'editor')}']", text: /Ornamentar harmonia/
    assert_select "section", text: /Criar baixo/

    sign_out user
    sign_in User.create!(email: "next-other@example.com", password: "senha-segura")
    get next_step_composition_path(composition)
    assert_response :not_found
  end

  # A leitura usa o documento em memória, sem persistir análise ou notas.
  test "analisa selecao atual sem salvar e restringe acesso ao proprietario" do
    composition = saved_composition
    document = composition.document.deep_dup
    document["context"] = { "tonic" => "C", "mode" => "major" }
    sign_in user
    assert_no_changes -> { composition.reload.document } do
      post assistance_composition_path(composition), params: {
        document: document, track_id: "track-1", region_id: "region-1", note_ids: [ "note-1" ]
      }, as: :json
      assert_response :success
      assert_equal "C", response.parsed_body.fetch("suggestions").first.fetch("symbol")
    end
    sign_out user
    other = User.create!(email: "reader@example.com", password: "senha-segura")
    sign_in other
    post assistance_composition_path(composition), params: {
      document: document, track_id: "track-1", region_id: "region-1", note_ids: []
    }, as: :json
    assert_response :not_found
  end
  # O formulário HTML mantém contexto e notas ao salvar sem JavaScript.
  test "formulario salva contexto opcional e preserva notas" do
    sign_in user
    composition = saved_composition
    patch composition_path(composition), params: { lock_version: composition.lock_version,
      composition: { name: "Ideia", bpm: "120", numerator: "4", denominator: "4", tonic: "A", mode: "natural_minor" } }
    assert_redirected_to composition_path(composition)
    assert_equal({ "tonic" => "A", "mode" => "natural_minor" }, composition.reload.document["context"])
    assert_equal 60, composition.document.dig("tracks", 0, "regions", 0, "notes", 0, "pitch")
  end

  # O catálogo pertence ao usuário autenticado; visitantes vão para o login.
  test "visitante nao acessa composicoes" do
    get compositions_path
    assert_redirected_to new_user_session_path
  end

  # Criar gera um documento vazio que pode ser reaberto sem perder metadados.
  test "cria lista e reabre composicao vazia" do
    sign_in user

    assert_difference("Composition.count", 1) do
      post compositions_path, params: { name: "Minha ideia" }
    end

    created_id = response.location.split("/").last
    composition = user.compositions.find(created_id)
    assert_redirected_to composition_path(composition)
    assert_equal user.id, composition.user_id
    assert_equal composition.id, composition.document["id"]
    assert_equal [], composition.document["tracks"]
    get compositions_path
    assert_response :success
    assert_select "a[href='#{composition_path(composition)}']", text: /Minha ideia/
    get composition_path(composition, format: :json)
    assert_response :success
    assert_equal composition.document, response.parsed_body.fetch("document")
    assert_equal 0, response.parsed_body.fetch("lock_version")
  end

  # A busca trata curingas de LIKE como parte literal do nome JSON.
  test "busca nomes com sublinhado e porcentagem literalmente" do
    sign_in user
    underscore = empty_composition.tap { |item| item.update!(document: item.document.merge("name" => "Estudo_1")) }
    percent = empty_composition.tap { |item| item.update!(document: item.document.merge("name" => "100% música")) }
    wildcard_match = empty_composition.tap { |item| item.update!(document: item.document.merge("name" => "EstudoX1")) }

    get compositions_path, params: { q: "Estudo_1" }
    assert_response :success
    assert_select "a[href='#{composition_path(underscore)}']", text: /Estudo_1/
    assert_select "a[href='#{composition_path(percent)}']", count: 0
    assert_select "a[href='#{composition_path(wildcard_match)}']", count: 0

    get compositions_path, params: { q: "100% música" }
    assert_response :success
    assert_select "a[href='#{composition_path(percent)}']", text: /100% música/
    assert_select "a[href='#{composition_path(underscore)}']", count: 0
  end

  # O formulário salva metadados sem descartar a árvore musical existente.
  test "renomeia e altera andamento e compasso preservando notas" do
    sign_in user
    composition = saved_composition
    previous_version = composition.lock_version
    patch composition_path(composition), params: { lock_version: composition.lock_version,
      composition: { name: "Novo nome", bpm: "110", numerator: "3", denominator: "4" } }

    assert_redirected_to composition_path(composition)
    composition.reload
    assert_equal "Novo nome", composition.document["name"]
    assert_equal 110, composition.document["bpm"]
    assert_equal 3, composition.document.dig("time_signature", "numerator")
    assert_equal 60, composition.document.dig("tracks", 0, "regions", 0, "notes", 0, "pitch")
    assert_equal previous_version + 1, composition.lock_version
  end

  # O endpoint JSON recebe o documento inteiro e reconstrói a mesma música.
  test "salva e reabre faixas instrumentos regioes e notas por json" do
    sign_in user
    composition = empty_composition
    document = composition.document.deep_dup
    document["tracks"] = [ track_data ]

    patch composition_path(composition, format: :json), params: {
      document: document, lock_version: composition.lock_version
    }, as: :json

    assert_response :success
    assert_equal 1, response.parsed_body.fetch("lock_version")
    get composition_path(composition, format: :json)
    assert_equal document, response.parsed_body.fetch("document")
    assert_equal "strings", Composition.find(composition.id).document.dig("tracks", 0, "instrument_id")
  end

  # Marcadores pertencem ao documento versionado e sobrevivem ao formulário de metadados.
  test "salva reabre e preserva marcadores de loop em formularios e conflitos" do
    sign_in user
    composition = empty_composition
    document = composition.document.deep_dup
    document["loop"] = { "start_tick" => 480, "end_tick" => 2400 }

    patch composition_path(composition, format: :json), params: {
      document: document, lock_version: composition.lock_version
    }, as: :json
    assert_response :success
    get composition_path(composition, format: :json)
    assert_equal document["loop"], response.parsed_body.dig("document", "loop")

    patch composition_path(composition), params: { lock_version: composition.reload.lock_version,
      composition: { name: "Com loop", bpm: "110", numerator: "4", denominator: "4" } }
    assert_redirected_to composition_path(composition)
    assert_equal document["loop"], composition.reload.document["loop"]

    stale = composition.document.deep_dup
    stale["loop"] = { "start_tick" => 0, "end_tick" => 960 }
    patch composition_path(composition, format: :json), params: {
      document: stale, lock_version: 0
    }, as: :json
    assert_response :conflict
    assert_equal document["loop"], composition.reload.document["loop"]
  end

  # O aceite cobre duas fontes no mesmo documento e sua reabertura.
  test "aceite da reproducao com duas faixas e loop persistido" do
    sign_in user
    composition = empty_composition
    second = track_data.deep_dup
    second["id"] = "track-2"
    second["name"] = "Cordas"
    second["instrument_id"] = "strings"
    second["regions"][0]["id"] = "region-2"
    second["regions"][0]["start_tick"] = 1920
    second["regions"][0]["notes"][0]["id"] = "note-2"
    document = composition.document.deep_dup
    document["tracks"] = [ track_data, second ]
    document["loop"] = { "start_tick" => 480, "end_tick" => 2400 }

    patch composition_path(composition, format: :json), params: {
      document: document, lock_version: composition.lock_version
    }, as: :json
    assert_response :success
    get composition_path(composition, format: :json)
    assert_response :success
    assert_equal document, response.parsed_body.fetch("document")
    sign_out user
    get composition_path(composition)
    assert_redirected_to new_user_session_path
  end

  # A edição de uma região deve sobreviver à recarga sem reescrever outra faixa.
  test "reabre notas editadas apenas na regiao selecionada e preserva caminhos existentes" do
    sign_in user
    composition = empty_composition
    original_second = track_data.deep_dup
    original_second["id"] = "track-2"
    original_second["regions"][0]["id"] = "region-2"
    original_second["regions"][0]["notes"][0]["id"] = "note-2"
    document = composition.document.deep_dup
    document["tracks"] = [ track_data, original_second ]
    edited = document["tracks"][0]["regions"][0]["notes"][0]
    edited["pitch"] = 72
    edited["velocity"] = 127
    edited["duration_ticks"] = 960

    patch composition_path(composition, format: :json), params: {
      document: document, lock_version: composition.lock_version
    }, as: :json

    assert_response :success
    get composition_path(composition, format: :json)
    assert_response :success
    saved = response.parsed_body.fetch("document")
    assert_equal 72, saved.dig("tracks", 0, "regions", 0, "notes", 0, "pitch")
    assert_equal 127, saved.dig("tracks", 0, "regions", 0, "notes", 0, "velocity")
    assert_equal 960, saved.dig("tracks", 0, "regions", 0, "notes", 0, "duration_ticks")
    assert_equal original_second, saved.dig("tracks", 1)
  end

  # Dados MIDI inválidos recebem erro e não substituem o documento salvo.
  test "rejeita documento invalido sem gravar" do
    sign_in user
    composition = empty_composition
    invalid = composition.document.deep_dup
    invalid["tracks"] = [ track_data ]
    invalid["tracks"][0]["regions"][0]["notes"][0]["pitch"] = 128

    patch composition_path(composition, format: :json), params: {
      document: invalid, lock_version: composition.lock_version
    }, as: :json

    assert_response :unprocessable_entity
    assert_equal [], composition.reload.document["tracks"]
    assert_equal 0, composition.lock_version
  end

  # A identidade do documento deve continuar igual à identidade da URL.
  test "rejeita documento com id de outra composicao" do
    sign_in user
    composition = empty_composition
    invalid = composition.document.deep_dup
    invalid["id"] = "another-id"

    patch composition_path(composition, format: :json), params: {
      document: invalid, lock_version: 0
    }, as: :json

    assert_response :unprocessable_entity
    assert_equal composition.id, composition.reload.document["id"]
  end

  # Uma aba antiga não pode sobrescrever silenciosamente uma versão mais nova.
  test "devolve conflito ao salvar versao antiga" do
    sign_in user
    composition = empty_composition
    first = composition.document.deep_dup
    first["name"] = "Versão nova"
    patch composition_path(composition, format: :json), params: { document: first, lock_version: 0 }, as: :json
    assert_response :success

    old = composition.document.deep_dup
    old["name"] = "Versão antiga"
    patch composition_path(composition, format: :json), params: { document: old, lock_version: 0 }, as: :json

    assert_response :conflict
    assert_equal "Versão nova", composition.reload.document["name"]
    assert_equal 1, composition.lock_version
  end

  # O formulário também deve explicar conflito sem sobrescrever a música salva.
  test "mostra conflito no formulario com versao antiga" do
    sign_in user
    composition = empty_composition
    composition.update!(document: composition.document.merge("name" => "Atual"))

    patch composition_path(composition), params: { lock_version: 0,
      composition: { name: "Antigo", bpm: "120", numerator: "4", denominator: "4" } }

    assert_response :conflict
    assert_select "[role='alert']", text: /mudou em outra aba/i
    assert_equal "Atual", composition.reload.document["name"]
  end

  # Um BPM fora do contrato não deve derrubar a página nem modificar a versão.
  test "mostra erro de andamento invalido no formulario" do
    sign_in user
    composition = empty_composition

    patch composition_path(composition), params: { lock_version: 0,
      composition: { name: "Ideia", bpm: "zero", numerator: "4", denominator: "4" } }

    assert_response :unprocessable_entity
    assert_select "[role='alert']", text: /Dados musicais inválidos/
    assert_equal 0, composition.reload.lock_version
  end

  # A busca sempre parte de current_user para ocultar documentos de terceiros.
  test "nao lista nem abre altera ou exclui composicao de outro usuario" do
    owner = user
    other = User.create!(email: "other@example.com", password: "senha-segura")
    composition = empty_composition(owner)
    sign_in other

    get compositions_path
    assert_response :success
    assert_select "a[href='#{composition_path(composition)}']", count: 0
    get composition_path(composition)
    assert_response :not_found
    patch composition_path(composition, format: :json), params: {
      document: composition.document, lock_version: 0
    }, as: :json
    assert_response :not_found
    assert_no_difference("Composition.count") { delete composition_path(composition) }
    assert_response :not_found
  end

  # Excluir exige uma ação explícita e retira apenas a composição própria.
  test "exclui composicao propria com confirmacao no formulario" do
    sign_in user
    composition = empty_composition
    get composition_path(composition)
    assert_select "form[action='#{composition_path(composition)}'][data-turbo-confirm] button", text: /Excluir/

    assert_difference("Composition.count", -1) { delete composition_path(composition) }
    assert_redirected_to compositions_path
  end

  private

  # Cria uma conta independente para cada teste de autorização.
  def user
    @user ||= User.create!(email: "owner@example.com", password: "senha-segura")
  end

  # Usa o mesmo contrato que o endpoint deve entregar ao navegador.
  def empty_composition(owner = user)
    id = SecureRandom.uuid
    Composition.create!(id: id, user: owner, document: {
      "version" => 1, "id" => id, "name" => "Ideia", "bpm" => 120,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "tracks" => []
    })
  end

  # Reabre uma composição com MIDI para testar que a edição de metadados não apaga notas.
  def saved_composition
    empty_composition.tap do |composition|
      document = composition.document.deep_dup
      document["tracks"] = [ track_data ]
      composition.update!(document: document)
    end
  end

  # Evento dentro de uma região, com instrumento que já existe no protótipo.
  def track_data
    { "id" => "track-1", "name" => "Melodia", "instrument_id" => "strings",
      "volume" => 0.8, "mute" => false, "solo" => false, "regions" => [
        { "id" => "region-1", "start_tick" => 0, "duration_ticks" => 1920, "notes" => [
          { "id" => "note-1", "pitch" => 60, "onset_tick" => 0,
            "duration_ticks" => 480, "velocity" => 100 }
        ] }
      ] }
  end
end
