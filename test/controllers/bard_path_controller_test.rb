require "test_helper"

# Valida leitura livre, proteção de conta e conclusão da aula pela interface HTTP.
class BardPathControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @owner = User.create!(email: "trilha@example.com", password: "senha-segura")
    sign_in @owner
    BardPathController.append_view_path(Rails.root.join("test/fixtures/views"))
  end

  # Nenhuma rota da jornada deve expor progresso sem sessão autenticada.
  test "exige login na trilha aula e conclusao" do
    sign_out @owner

    get bard_path_index_path
    assert_redirected_to new_user_session_path
    get bard_path_lesson_path(slug: "notas")
    assert_redirected_to new_user_session_path
    post complete_bard_path_lesson_path(slug: "notas")
    assert_redirected_to new_user_session_path
  end

  # O catálogo real libera as sete paradas, mantendo a mesma navegação do mapa.
  test "trilha apresenta sete aulas publicadas" do
    get bard_path_index_path

    assert_response :success
    assert_select ".bard-map-sign", count: 0
    assert_select ".bard-journey > h1", count: 0
    assert_select ".bard-journey > .bard-journey-progress", count: 0
    assert_select "[data-lesson-slug]", count: 0
    assert_select ".bard-path-empty", count: 0
    assert_select ".bard-map-road", count: 7
    assert_select "dialog[data-summary]:not([open])", count: 7
    assert_select 'button[aria-haspopup="dialog"]', count: 7
    assert_select '[data-preview="true"][data-visit-url=""]', count: 0
    assert_select ".bard-map-summary h2", text: "Minha primeira ideia musical"
    assert_select ".bard-journey-heading", count: 0
    assert_select ".bard-map-origin span", count: 0
    assert_select '.bard-map-viewport[tabindex="0"][role="region"]', count: 1
    assert_select ".bard-journey-progress", count: 0
    assert_select '[data-controller="bard-travel"]'
    assert_select ".bard-map a[href=?]", bard_path_lesson_path(slug: "tempos"), minimum: 1
  end

  # As paradas mantêm conclusão individual e acesso livre sem a placa removida.
  test "cenario apresenta progresso real e todas as paradas acessiveis" do
    @owner.lesson_completions.create!(lesson_slug: "notas", completed_at: Time.current)
    @owner.lesson_completions.create!(lesson_slug: "fora-do-catalogo", completed_at: Time.current)
    with_catalog(catalog) do
      get bard_path_index_path
      assert_response :success
      assert_select ".bard-map-sign", count: 0
      assert_select '[data-slug="notas"][data-completed="true"]'
      assert_select '[data-slug="ritmo"][data-completed="false"]'
      assert_select ".bard-map li[data-slug]", count: 3
      assert_select 'button[data-action="bard-travel#select"]', count: 3
      assert_select ".bard-map a[href=?]", bard_path_lesson_path(slug: "ritmo")
      assert_select ".bard-map a[href=?]", bard_path_lesson_path(slug: "notas")
    end
  end

  # A segunda aula pode ser aberta antes da primeira, sem bloquear a leitura.
  test "abre qualquer aula publicada em ordem livre" do
    with_catalog(catalog) do
      get bard_path_lesson_path(slug: "ritmo")
      assert_response :success
      assert_select "h1", text: "Ritmo"
      assert_select ".bard-lesson-content", text: /exemplo de ritmo/i

      get bard_path_lesson_path(slug: "notas")
      assert_response :success
      assert_select "h1", text: "Notas"
    end
  end

  # Reenvios não duplicam progresso nem alteram a data da primeira conclusão.
  test "conclusao repetida mantem o primeiro registro" do
    with_catalog(catalog) do
      assert_difference("@owner.lesson_completions.count", 1) do
        post complete_bard_path_lesson_path(slug: "ritmo")
        assert_redirected_to bard_path_lesson_path(slug: "ritmo")
      end
      completed_at = @owner.lesson_completions.last.completed_at

      assert_no_difference("@owner.lesson_completions.count") do
        post complete_bard_path_lesson_path(slug: "ritmo")
      end
      assert_equal completed_at, @owner.lesson_completions.last.completed_at
    end
  end

  # A conclusão de uma pessoa não marca a trilha de outra pessoa.
  test "trilha isola o progresso entre usuarios" do
    with_catalog(catalog) do
      post complete_bard_path_lesson_path(slug: "notas")
      get bard_path_index_path
      assert_select '[data-slug="notas"][data-completed="true"]', count: 1

      sign_out @owner
      sign_in User.create!(email: "outro-bardo@example.com", password: "senha-segura")
      get bard_path_index_path
      assert_select '[data-slug="notas"][data-completed="false"]', count: 1
    end
  end

  # Identificadores sem publicação ou sem corpo de aula não geram página ou conclusão.
  test "recusa aula desconhecida nao publicada ou sem conteudo" do
    with_catalog(catalog) do
      # A primeira resposta bem-sucedida grava a sessão simulada do Devise.
      get bard_path_index_path
      %w[desconhecida harmonia segredo].each do |slug|
        get bard_path_lesson_path(slug: slug)
        assert_response :not_found
        assert_no_difference("@owner.lesson_completions.count") do
          post complete_bard_path_lesson_path(slug: slug)
        end
        assert_response :not_found
      end
    end
  end

  # Visitar salva a posição privada sem marcar a aula como concluída.
  test "salva visita na conta sem concluir e restaura no mapa" do
    with_catalog(catalog) do
      assert_no_difference("LessonCompletion.count") do
        post visit_bard_path_lesson_path(slug: "ritmo"), as: :json
        assert_response :success
      end
      assert_equal "ritmo", @owner.reload.last_bard_lesson_slug
      get bard_path_index_path
      assert_select '[data-bard-travel-last-value="ritmo"]'
      post visit_bard_path_lesson_path(slug: "desconhecida"), as: :json
      assert_response :not_found
      assert_equal "ritmo", @owner.reload.last_bard_lesson_slug
      sign_out @owner
      other = User.create!(email: "visitante@example.com", password: "senha-segura")
      sign_in other
      get bard_path_index_path
      assert_select '[data-bard-travel-last-value=""]'
      assert_nil other.reload.last_bard_lesson_slug
    end
  end

  # Posições antigas não devem apontar para uma aula que saiu do catálogo.
  test "ignora visita removida e protege endpoint de visita" do
    @owner.update!(last_bard_lesson_slug: "removida")
    with_catalog(catalog) do
      get bard_path_index_path
      assert_select '[data-bard-travel-last-value=""]'
    end
    sign_out @owner
    post visit_bard_path_lesson_path(slug: "notas"), as: :json
    assert_response :unauthorized
  end

  # Exercita o conteúdo real e a conclusão persistida, sem substituir o catálogo.
  test "primeira aula oferece pratica e permite concluir sem obrigar a tocar audio" do
    get bard_path_lesson_path(slug: "tempos")
    assert_response :success
    assert_select "h1", text: "Sentindo os tempos da música"
    assert_select '[data-controller="lesson-pulse"]', count: 1
    assert_select 'select[data-lesson-pulse-target="tempo"] option', count: 3
    assert_select '[data-lesson-pulse-target="beat"]', count: 4
    assert_select 'button.bard-audio-play[data-audio-state="idle"] svg.bard-play-guitar[aria-hidden="true"]', count: 1
    assert_select ".bard-lesson-content details", count: 4
    assert_select ".bard-lesson-content section", minimum: 7
    assert_difference("@owner.lesson_completions.count", 1) do
      post complete_bard_path_lesson_path(slug: "tempos")
    end
    follow_redirect!
    assert_select ".bard-lesson-footer", text: /Você concluiu esta aula/
    get bard_path_index_path
    assert_select '[data-slug="tempos"][data-completed="true"]'
    get bard_path_lesson_path(slug: "ritmo-e-pausas")
    assert_response :success
  end

  # A trilha libera os seis corpos seguintes mantendo conclusão manual e leitura livre.
  test "aulas seguintes exibem exemplos e permanecem abertas em qualquer ordem" do
    %w[ritmo-e-pausas compassos escuta notas oitavas primeira-ideia].reverse_each do |slug|
      get bard_path_lesson_path(slug: slug)
      assert_response :success
      assert_select "[data-controller='lesson-examples']", minimum: 1
      assert_select ".bard-lesson-content details", minimum: 2
      assert_select ".bard-example-play", minimum: 2
      assert_select ".bard-example-play[data-instrument='piano']", minimum: 1
      assert_select '.bard-example-play[data-audio-state="idle"] svg.bard-play-guitar[aria-hidden="true"]', minimum: 2
    end
    get bard_path_lesson_path(slug: "escuta")
    assert_select ".bard-example-play[data-instrument='sine']", count: 1
    get bard_path_index_path
    assert_select '[data-preview="true"]', count: 0
  end

  # O teclado precisa mostrar a repetição dos nomes e oferecer rótulos sem áudio.
  test "aulas de notas e oitavas mostram teclas nomeadas" do
    get bard_path_lesson_path(slug: "notas")
    assert_select ".bard-lesson-keyboard [data-note='C4']", count: 1
    assert_select ".bard-lesson-keyboard [data-note='B4']", count: 1
    get bard_path_lesson_path(slug: "oitavas")
    assert_select ".bard-lesson-keyboard [data-note='C3']", count: 1
    assert_select ".bard-lesson-keyboard [data-note='C4']", count: 1
  end

  private

  # Troca somente a fonte editorial durante a requisição e restaura o método original.
  def with_catalog(test_catalog)
    original = BardPath::LessonCatalog.method(:current)
    BardPath::LessonCatalog.define_singleton_method(:current) { test_catalog }
    yield
  ensure
    BardPath::LessonCatalog.define_singleton_method(:current, original) if original
  end

  # Simula somente o catálogo editorial; controller, rotas e banco seguem reais.
  def catalog
    entries = [
      { "slug" => "notas", "title" => "Notas", "summary" => "Alturas e nomes", "position" => 1, "published" => true },
      { "slug" => "ritmo", "title" => "Ritmo", "summary" => "Tempos e duração", "position" => 2, "published" => true },
      { "slug" => "harmonia", "title" => "Harmonia", "summary" => "Acordes", "position" => 3, "published" => false },
      { "slug" => "segredo", "title" => "Sem corpo", "summary" => "Não disponível", "position" => 4, "published" => true }
    ]
    BardPath::LessonCatalog.new(entries: entries, template_exists: ->(slug) { %w[notas ritmo].include?(slug) })
  end
end
