require "test_helper"

# Garante que a trilha mostre somente aulas publicadas com conteúdo válido.
class BardPath::LessonCatalogTest < ActiveSupport::TestCase
  # Um catálogo vazio permite iniciar o produto sem publicar aulas incompletas.
  test "catalogo vazio nao oferece aulas" do
    catalog = BardPath::LessonCatalog.new(entries: [], template_exists: ->(_) { false })

    assert_empty catalog.published
  end

  # A ordem editorial organiza a trilha, mas não restringe a leitura de aulas.
  test "lista aulas publicadas em ordem e encontra qualquer uma" do
    catalog = BardPath::LessonCatalog.new(
      entries: [entry("ritmo", 2), entry("notas", 1), entry("harmonia", 3, published: false)],
      template_exists: ->(_) { true }
    )

    assert_equal %w[notas ritmo], catalog.published.map(&:slug)
    assert_equal "ritmo", catalog.find_published!("ritmo").slug
  end

  # A URL não pode revelar aulas planejadas ou páginas sem texto publicado.
  test "recusa aula desconhecida nao publicada ou sem template" do
    catalog = BardPath::LessonCatalog.new(
      entries: [entry("notas", 1), entry("ritmo", 2, published: false), entry("harmonia", 3)],
      template_exists: ->(slug) { slug == "notas" }
    )

    assert_equal ["notas"], catalog.published.map(&:slug)
    %w[desconhecida ritmo harmonia].each do |slug|
      assert_raises(ActiveRecord::RecordNotFound) { catalog.find_published!(slug) }
    end
  end

  # Slugs seguros impedem caminhos arbitrários; identificadores e posições não se repetem.
  test "recusa metadados invalidos" do
    valid = entry("notas", 1)
    invalid_cases = [
      [entry("../segredo", 1)],
      [valid, entry("notas", 2)],
      [valid, entry("ritmo", 1)],
      [valid.merge("title" => " ")],
      [valid.merge("summary" => "")],
      [valid.merge("published" => "yes")]
    ]

    invalid_cases.each do |entries|
      assert_raises(ArgumentError) do
        BardPath::LessonCatalog.new(entries: entries, template_exists: ->(_) { true })
      end
    end
  end

  private

  # Cria metadados legíveis para variar somente a condição de cada teste.
  def entry(slug, position, published: true)
    { "slug" => slug, "title" => slug.capitalize, "summary" => "Resumo de #{slug}",
      "position" => position, "published" => published }
  end
end
