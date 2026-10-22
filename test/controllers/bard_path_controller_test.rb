require "test_helper"

# Valida leitura livre, proteção de conta e conclusão da aula pela interface HTTP.
class BardPathControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @owner = User.create!(email: "trilha@example.com", password: "senha-segura")
    sign_in @owner
    BardPathController.prepend_view_path(Rails.root.join("test/fixtures/views"))
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

  # A estrutura pode entrar no ar antes de existir texto de aula publicado.
  test "trilha vazia mostra preparacao" do
    get bard_path_index_path

    assert_response :success
    assert_select "h1", text: "Caminho do Bardo"
    assert_select "[data-lesson-slug]", count: 0
    assert_select ".bard-path-empty", text: /preparação/i
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
      assert_select '[data-lesson-slug="notas"][data-completed="true"]', count: 1

      sign_out @owner
      sign_in User.create!(email: "outro-bardo@example.com", password: "senha-segura")
      get bard_path_index_path
      assert_select '[data-lesson-slug="notas"][data-completed="false"]', count: 1
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
