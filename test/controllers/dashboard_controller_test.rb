require "test_helper"

# Verifica a navegação e os relatórios apresentados na área administrativa.
class DashboardControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  test "apresentacao oferece login na abertura e na ultima secao ao visitante" do
    get presentation_path
    assert_response :success

    # O visitante encontra a entrada antes de tentar acessar a área restrita.
    assert_select '.story-opening .story-button[href="/users/sign_in"]', text: "Entrar no Bardian", count: 1
    assert_select '#caminho-do-bardo .story-button[href="/users/sign_in"]', text: "Entrar no Bardian", count: 1
  end

  test "apresentacao oferece dashboard ao administrador" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get presentation_path

    assert_response :success
    assert_select '.story-opening .story-button[href="/dashboard"]', text: "Ir para o Bardian", count: 1
    assert_select '#caminho-do-bardo .story-button[href="/dashboard"]', text: "Ir para o Bardian", count: 1
  end

  # A entrega registrada deve ser legível e oferecer uma rota real de teste.
  test "administrador encontra o primeiro dev report na dashboard" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get dashboard_path

    assert_response :success
    assert_select "main.dashboard-page"
    assert_select ".dashboard-sidebar"
    assert_select '.dashboard-nav-link.is-active[aria-current="page"]', text: /Visão geral/
    assert_select 'main.dashboard-content[aria-label="Área de trabalho"]'
    assert_select ".dashboard-header", count: 0
    assert_select "main.dashboard-content > section#dev-reports", count: 1
    assert_select "main.dashboard-content", text: /Administração · acompanhamento do desenvolvimento/, count: 0
    assert_select "section#dev-reports table", count: 1
    assert_select "tr.dashboard-report-row", count: 10
    assert_select 'tr.dashboard-report-row a[href="/criar"]', text: "Testar"
    assert_select "tr.dashboard-report-row", text: /Dashboard administrativa e DevReports/
    assert_select "tr.dashboard-report-row", text: /passou a apresentar as entregas verificáveis/
    assert_select "tr.dashboard-report-row .dashboard-tag", text: "Interface"
    assert_select "tr.dashboard-report-row .dashboard-tag", text: "Administração"
    assert_select "tr.dashboard-report-row time", text: "13/10/2026"
    assert_select "tr.dashboard-report-details details summary", text: "Ver alterações"
    assert_select "tr.dashboard-report-details li", text: /partials/
    assert_select 'tr.dashboard-report-row a[href="/dashboard#dev-reports"]', text: "Testar"
    assert_select 'form.dashboard-filters[action="/dashboard"][method="get"]'
    assert_select 'label[for="report-query"]', text: "Buscar entrega"
    assert_select "select#report-tag option", text: "Interface"
    assert_select 'a[href="/dashboard"]', text: "Limpar filtros"
    assert_select '.dashboard-nav-link[href="/dashboard"]', text: /Visão geral/
    assert_select '.dashboard-nav-link[href="/apresentacao"]', count: 0
    assert_select '.dashboard-nav-link[href="/apresentacao#primeiro-som"]', count: 0
    assert_select '.dashboard-nav-link[href="/apresentacao#processo-criativo"]', count: 0
    assert_select '.dashboard-nav-link[href="/caminho-do-bardo/notas"]', text: /Caminho do Bardo/
    assert_select '.dashboard-nav-link[href^="#"]', count: 0
    assert_select 'nav[aria-label="Conta"] form[action="/users/sign_out"] button', text: "Sair"
  end

  # Busca e tag devem selecionar a entrega pelos dados realmente registrados.
  test "administrador filtra os dev reports por texto e tag" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get dashboard_path, params: { q: "DASHBOARD", tag: "Interface" }

    assert_response :success
    assert_select "tr.dashboard-report-row", count: 1
    assert_select 'input#report-query[value="DASHBOARD"]'
    assert_select 'select#report-tag option[selected="selected"]', text: "Interface"
  end

  # Filtros sem correspondência não devem retornar a lista completa.
  test "dashboard mostra estado vazio quando nao encontra entrega" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get dashboard_path, params: { tag: "Inexistente" }

    assert_response :success
    assert_select "tr.dashboard-report-row", count: 0
    assert_select ".dashboard-empty-state", text: /Nenhuma entrega encontrada/
  end

  # Parâmetros estruturados não podem causar erro ao renderizar os filtros.
  test "dashboard ignora busca e tag que nao sejam texto" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get dashboard_path, params: { q: [ "dashboard" ], tag: { valor: "Interface" } }

    assert_response :success
    assert_select "tr.dashboard-report-row", count: 10
  end
end
