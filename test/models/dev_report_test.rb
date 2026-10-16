require "test_helper"
require "tempfile"

# Verifica que o catálogo de entregas expõe apenas registros completos e úteis.
class DevReportTest < ActiveSupport::TestCase
  # Cada entrega registrada deve oferecer contexto e uma rota interna para verificação.
  test "carrega os relatorios da dashboard" do
    reports = DevReport.load

    assert_equal 11, reports.length
    assert_equal "/compositions", reports.find { |item| item.slug == "reproducao-composicao-loop-mvp1" }.test_path
    assert_equal "/compositions", reports.find { |item| item.slug == "piano-roll-regioes-persistidas" }.test_path
    assert_equal "/criar", reports.find { |item| item.slug == "arranjo-canvas-instrumentos-iniciais" }.test_path
    creation_report = reports.find { |item| item.slug == "criacao-camadas-frases" }
    assert_equal "/criar", creation_report.test_path
    report = reports.find { |item| item.slug == "dashboard-dev-reports" }
    assert_equal "Dashboard administrativa e DevReports", report.title
    assert report.description.present?
    assert report.changes.any?
    assert_includes report.tags, "Interface"
    assert_equal "/dashboard#dev-reports", report.test_path
    assert_kind_of Date, report.delivered_on
  end

  # A busca deve encontrar texto de campos descritivos, sem depender de maiúsculas.
  test "busca titulo descricao alteracoes e tags sem diferenciar caixa" do
    reports = DevReport.load
    dashboard_report = reports.find { |item| item.slug == "dashboard-dev-reports" }

    %w[DASHBOARD verificáveis interface].each do |query|
      expected = query == "interface" ? reports : [ dashboard_report ]
      assert_equal expected, DevReport.filter(reports: reports, query: query, tag: "")
    end
    assert_equal [ reports.find { |item| item.slug == "piano-roll-webmusic-score" } ], DevReport.filter(reports: reports, query: "BandLab", tag: "")
  end

  # Tags não cadastradas não devem transformar o filtro em uma listagem geral.
  test "filtra por tag e combina com a busca" do
    reports = DevReport.load
    dashboard_report = reports.find { |item| item.slug == "dashboard-dev-reports" }

    assert_equal reports, DevReport.filter(reports: reports, query: "", tag: "Interface")
    assert_equal [ dashboard_report ], DevReport.filter(reports: reports, query: "dashboard", tag: "Interface")
    assert_empty DevReport.filter(reports: reports, query: "", tag: "Inexistente")
    assert_equal [ reports.find { |item| item.slug == "piano-roll-webmusic-score" } ], DevReport.filter(reports: reports, query: "BandLab", tag: "Interface")
    assert_equal reports, DevReport.filter(reports: reports, query: "", tag: "")
    assert_equal [ "Acessibilidade", "Administração", "Aprendizagem", "Composição", "Interface", "MIDI", "Notas", "Tema", "Áudio" ], DevReport.tags(reports: reports)
  end

  # Um catálogo incompleto deve falhar antes de gerar uma linha sem sentido.
  test "rejeita campo obrigatorio ausente" do
    catalog = valid_catalog
    catalog.fetch("reports").first.delete("description")

    error = assert_raises(ArgumentError) { load_catalog(catalog) }
    assert_match(/description/, error.message)
  end

  # Caminhos externos ou relativos não podem virar links de teste no painel.
  test "rejeita links de teste que nao sejam caminhos internos" do
    [ "https://example.com", "//example.com", "dashboard" ].each do |path|
      catalog = valid_catalog
      catalog.fetch("reports").first["test_path"] = path

      error = assert_raises(ArgumentError) { load_catalog(catalog) }
      assert_match(/test_path/, error.message)
    end
  end

  private

  # Fornece um catálogo mínimo válido para variar somente o campo sob teste.
  def valid_catalog
    {
      "reports" => [ {
        "slug" => "entrega-teste",
        "title" => "Entrega teste",
        "description" => "Resumo da entrega.",
        "changes" => [ "Criou uma tela." ],
        "delivered_on" => "2026-10-13",
        "tags" => [ "Interface" ],
        "test_path" => "/dashboard"
      } ]
    }
  end

  # Carrega YAML temporário pelo mesmo caminho usado para o catálogo real.
  def load_catalog(catalog)
    Tempfile.create([ "dev_reports", ".yml" ]) do |file|
      file.write(YAML.dump(catalog))
      file.flush
      DevReport.load(path: file.path)
    end
  end
end
