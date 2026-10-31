require "test_helper"

# Garante que a superfície pública corresponda apenas ao fluxo atual do TCC.
class LegacyRoutesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  test "visitante entra pelo login ao acessar o root" do
    get "/"

    assert_redirected_to new_user_session_path
  end

  test "usuario autenticado ve a biblioteca pelo root" do
    sign_in User.create!(email: "library@example.com", password: "senha-segura")

    get "/"

    assert_response :success
    assert_select "main.music-page"
  end

  test "rotas das experiencias antigas nao sao registradas" do
    %w[
      /apresentacao
      /componentes
      /criar
      /referencias/criar
      /harmonia
      /harmonia/assist
      /dashboard
      /audio_demo
      /audio_demo/index
      /compositions/00000000-0000-0000-0000-000000000000/legacy
    ].each do |path|
      get path

      assert_response :not_found, "esperava 404 para #{path}"
    end
  end

  test "a pagina de harmonia ativa nao referencia o endpoint publico legado" do
    view_path = Rails.root.join("app/views/harmony/show.html.erb")

    assert_not_includes File.read(view_path), "assist_harmony_path"
  end
end
