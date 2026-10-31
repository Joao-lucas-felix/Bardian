require "test_helper"

# Cobre o novo cadastro e proteção da capa, sem acoplar testes à decoração visual.
class CompositionLibraryTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @owner = User.create!(email: "library@example.com", password: "senha-segura")
    sign_in @owner
  end

  test "cria com capa renomeia sem alterar musica e remove capa" do
    upload = Rack::Test::UploadedFile.new(Rails.root.join("public/icon.png"), "image/png")
    post compositions_path, params: { composition: { name: "Estudo", cover: upload } }
    composition = @owner.compositions.last
    assert_redirected_to setup_composition_path(composition)
    assert composition.cover.attached?
    get cover_composition_path(composition)
    assert_response :success
    assert_equal "image/png", response.media_type
    patch composition_path(composition), params: { lock_version: composition.reload.lock_version,
      composition: { name: "Estudo novo", remove_cover: "1" } }
    assert_redirected_to composition_path(composition)
    assert_equal "Estudo novo", composition.reload.name
    assert_equal [], composition.document["tracks"]
    assert_not composition.cover.attached?
  end

  test "rejeita svg e nao permite leitura da capa alheia" do
    assert_no_difference("Composition.count") do
      post compositions_path, params: { composition: { name: "Inválida",
        cover: Rack::Test::UploadedFile.new(Rails.root.join("public/icon.svg"), "image/svg+xml") } }
      assert_response :unprocessable_entity
    end
    post compositions_path, params: { composition: { name: "Privada" } }
    composition = @owner.compositions.last
    sign_out @owner
    sign_in User.create!(email: "library-other@example.com", password: "senha-segura")
    get compositions_path
    assert_response :success
    get cover_composition_path(composition)
    assert_response :not_found
    get edit_composition_path(composition)
    assert_response :not_found
  end

  test "busca e ordena somente composicoes proprias" do
    %w[Zebra Aurora].each { |name| post compositions_path, params: { name: name } }
    get compositions_path, params: { q: "Aur", sort: "name" }
    assert_response :success
    assert_select ".music-row strong", text: "Aurora", count: 1
    assert_select ".music-row strong", text: "Zebra", count: 0
    get compositions_path, params: { sort: "name" }
    assert_equal %w[Aurora Zebra], css_select(".music-row strong").map(&:text)
  end
end
