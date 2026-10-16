require "test_helper"

# Exercita o CRUD de composições com autenticação, validação e controle de versão.
class CompositionsControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

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

    composition = Composition.last
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

  # A página entrega a timeline ligada ao mesmo formulário e endpoint JSON.
  test "abre timeline editavel da composicao salva" do
    sign_in user
    composition = saved_composition

    get composition_path(composition)

    assert_response :success
    assert_select "[data-controller='composition-timeline'][data-composition-timeline-url-value='#{composition_path(composition, format: :json)}']"
    assert_select "form[data-action*='submit->composition-timeline#save']"
    assert_select "[data-composition-timeline-target='tracks']"
    assert_select "[data-action='click->composition-timeline#addTrack']", text: /Adicionar faixa/
    assert_select "[data-composition-timeline-target='summary']", text: /1 faixa.*1 região.*1 nota/
    assert_select "[data-composition-timeline-target='regionEditor'] template"
    assert_select "[data-action*='piano-roll:notes-changed->composition-timeline#notesChanged']"
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
