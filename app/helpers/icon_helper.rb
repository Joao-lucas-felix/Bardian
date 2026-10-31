# Reutiliza o conjunto de ícones SVG da interface sem adicionar dependências.
module IconHelper
  # Renderiza um símbolo decorativo; o texto do controle continua sendo seu nome acessível.
  # @param name [String, Symbol] identificador do símbolo definido no layout.
  # @return [ActiveSupport::SafeBuffer] elemento SVG sem foco ou anúncio de leitura.
  def bard_icon(name)
    tag.svg(tag.use(href: "#bard-icon-#{name}"), class: "ui-icon", aria: { hidden: true }, focusable: "false")
  end
end
