# Disponibiliza a página inicial e a apresentação pública do Bardian.
class PagesController < ApplicationController
  # Renderiza os caminhos principais sem consultar ou modificar dados.
  # Não recebe parâmetros específicos.
  def home
  end

  # Renderiza a apresentação musical sem modificar dados.
  # Não recebe parâmetros específicos.
  def presentation
  end

  # Renderiza a área de componentes musicais sem consultar ou modificar dados.
  # O estado temporário do piano roll pertence ao controller Stimulus da página.
  def components
  end

  # Entrega somente os descritores visuais do Trecho 1; as notas ficam no navegador.
  def compose
    @creation_layers = [
      { key: "harmony", title: "Harmonia", description: "Comece pelos acordes que dão direção à sua ideia.", audio_enabled: true },
      { key: "bass", title: "Baixo", description: "Apoie os acordes com notas graves e um pulso simples.", audio_enabled: true },
      { key: "melody", title: "Melodia", description: "Desenhe a parte que você gostaria de cantarolar.", audio_enabled: true },
      { key: "drums", title: "Bateria", description: "Monte o pulso com bumbo, caixa e chimbal.", audio_enabled: true }
    ]
  end

  # Renderiza a primeira lição sem consultar ou modificar dados.
  # O estado do piano é controlado pelo controller Stimulus da própria página.
  def notes_lesson
  end
end
