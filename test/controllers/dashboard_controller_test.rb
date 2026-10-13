require "test_helper"

# Verifica a navegação pública entre a apresentação e a entrada da plataforma.
class DashboardControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  test "apresentacao oferece entrada na abertura e na ultima secao" do
    get root_url
    assert_response :success

    # Ambos os pontos de entrada devem levar ao mesmo destino real.
    assert_select '.story-opening a[href="/dashboard"]', text: "Ir para o Bardian", count: 1
    assert_select '#caminho-do-bardo a[href="/dashboard"]', text: "Ir para o Bardian", count: 1
  end

  test "administrador acessa a dashboard administrativa vazia" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get dashboard_path

    assert_response :success
    assert_select "main.dashboard-page"
    assert_select ".dashboard-sidebar"
    assert_select '.dashboard-nav-link.is-active[aria-current="page"]', text: /Visão geral/
    assert_select 'main.dashboard-content[aria-label="Área de trabalho"]'
    assert_select ".dashboard-card", count: 0
    assert_select ".dashboard-header", count: 0
  end
end
