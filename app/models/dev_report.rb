require "yaml"
require "date"

# Representa uma entrega concluída descrita no catálogo versionado do projeto.
# Não persiste dados no banco: a implementação e seu relatório evoluem juntos.
class DevReport
  attr_reader :slug, :title, :description, :changes, :delivered_on, :tags, :test_path

  # Carrega os registros do YAML e rejeita catálogos incompletos.
  # O caminho alternativo permite validar entradas isoladas em testes.
  def self.load(path: Rails.root.join("config/dev_reports.yml"))
    catalog = YAML.safe_load_file(path)
    records = catalog.is_a?(Hash) && catalog["reports"]
    raise ArgumentError, "reports deve ser uma lista" unless records.is_a?(Array)

    records.map { |record| new(record) }
  end

  # Seleciona entregas por texto livre e por uma tag, sem diferenciar maiúsculas.
  # Filtros vazios preservam todos os registros recebidos.
  def self.filter(reports:, query:, tag:)
    needle = query.to_s.strip.downcase
    selected_tag = tag.to_s.strip.downcase

    reports.select do |report|
      searchable = [ report.title, report.description, *report.changes, *report.tags ].join(" ").downcase
      matches_query = needle.empty? || searchable.include?(needle)
      matches_tag = selected_tag.empty? || report.tags.any? { |value| value.downcase == selected_tag }
      matches_query && matches_tag
    end
  end

  # Retorna as tags disponíveis sem duplicações, em ordem de apresentação.
  def self.tags(reports:)
    reports.flat_map(&:tags).uniq.sort
  end

  # Valida um registro do catálogo e preserva seus campos como valores estáveis.
  def initialize(record)
    raise ArgumentError, "registro deve ser um mapa" unless record.is_a?(Hash)

    @slug = required_text(record, "slug")
    @title = required_text(record, "title")
    @description = required_text(record, "description")
    @changes = required_list(record, "changes")
    @tags = required_list(record, "tags")
    @delivered_on = parse_date(record["delivered_on"])
    @test_path = required_text(record, "test_path")
    raise ArgumentError, "test_path deve ser um caminho interno" unless @test_path.match?(%r{\A/(?!/)[^\s\\]*\z})

    freeze
  end

  private

  # Normaliza texto obrigatório e nomeia o campo inválido na mensagem de erro.
  def required_text(record, key)
    value = record[key]
    raise ArgumentError, "#{key} deve ser texto não vazio" unless value.is_a?(String) && value.strip.present?

    value.strip.freeze
  end

  # Exige uma lista não vazia de textos, sem alterar o YAML original.
  def required_list(record, key)
    values = record[key]
    raise ArgumentError, "#{key} deve ser lista de textos" unless values.is_a?(Array) && values.any?

    values.map { |value| required_text({ key => value }, key) }.freeze
  end

  # Converte a data textual em Date e preserva uma mensagem de erro contextual.
  def parse_date(value)
    raise ArgumentError, "delivered_on deve ser data ISO-8601" unless value.is_a?(String)

    Date.iso8601(value)
  rescue Date::Error
    raise ArgumentError, "delivered_on deve ser data ISO-8601"
  end
end
