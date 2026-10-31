require "yaml"

module BardPath
  # Lê o catálogo editorial e expõe apenas aulas publicadas com corpo disponível.
  class LessonCatalog
    SLUG_PATTERN = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/

    # Representa os metadados de uma aula sem persistir conteúdo no banco.
    Lesson = Struct.new(:slug, :title, :summary, :position, :published, keyword_init: true) do
      # Informa se a aula foi liberada para leitura e conclusão.
      def published?
        published
      end
    end

    # Carrega o YAML versionado, ou um arquivo fornecido para verificação.
    # Um documento vazio representa uma trilha ainda sem aulas publicadas.
    def self.current(path: Rails.root.join("config/bard_path_lessons.yml"))
      data = YAML.safe_load(File.read(path))
      data = { "lessons" => [] } if data.nil?
      raise ArgumentError, "catálogo deve ser um objeto" unless data.is_a?(Hash)

      new(entries: data.fetch("lessons"), template_exists: lambda { |slug|
        Rails.root.join("app/views/bard_path/lessons/_#{slug}.html.erb").file?
      })
    end

    # Recebe entradas de metadados e uma função que verifica o corpo da aula.
    # Rejeita identificadores, textos, posições e estados de publicação inválidos.
    def initialize(entries:, template_exists:)
      raise ArgumentError, "lessons deve ser uma lista" unless entries.is_a?(Array)

      @lessons = entries.map { |entry| build_lesson(entry) }
      raise ArgumentError, "slugs duplicados" unless @lessons.map(&:slug).uniq.length == @lessons.length
      raise ArgumentError, "posições duplicadas" unless @lessons.map(&:position).uniq.length == @lessons.length

      @published = @lessons.select { |lesson| lesson.published? && template_exists.call(lesson.slug) }
        .sort_by(&:position).freeze
    end

    # Inclui prévias editoriais na trilha, sem tornar seu conteúdo acessível.
    # Uma aula marcada como publicada sem corpo continua oculta por inconsistência.
    def trail
      @lessons.select { |lesson| !lesson.published? || @published.include?(lesson) }.sort_by(&:position)
    end

    # Retorna aulas acessíveis em ordem de apresentação da trilha.
    def published
      @published
    end

    # Busca uma aula liberada pelo slug; rotas desconhecidas recebem 404.
    def find_published!(slug)
      @published.find { |lesson| lesson.slug == slug } || raise(ActiveRecord::RecordNotFound, "Aula não encontrada")
    end

    private

    # Converte uma entrada validada em metadados imutáveis para a interface.
    def build_lesson(entry)
      raise ArgumentError, "aula deve ser um objeto" unless entry.is_a?(Hash)

      slug = entry["slug"]
      title = entry["title"]
      summary = entry["summary"]
      position = entry["position"]
      state = entry["published"]
      raise ArgumentError, "slug inválido" unless slug.is_a?(String) && SLUG_PATTERN.match?(slug)
      raise ArgumentError, "title obrigatório" unless title.is_a?(String) && title.strip.present?
      raise ArgumentError, "summary obrigatório" unless summary.is_a?(String) && summary.strip.present?
      raise ArgumentError, "position inválida" unless position.is_a?(Integer) && position.positive?
      raise ArgumentError, "published deve ser booleano" unless state == true || state == false

      Lesson.new(slug: slug, title: title.strip, summary: summary.strip,
        position: position, published: state).freeze
    end
  end
end
