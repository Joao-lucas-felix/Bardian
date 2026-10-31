# Expõe os presets locais compartilhados com o build de áudio; não contém regras musicais.
class HarmonyInstrumentCatalog
  DEFINITIONS = JSON.parse(Rails.root.join("config/harmony_instruments.json").read).freeze

  # Retorna identidades, nomes e indicação opcional de lo-fi para apresentação.
  def self.options
    DEFINITIONS.map { |id, preset| { id: id, label: preset.fetch("label"), lofi: preset.fetch("lofi", false) } }
  end

  # Recusa fontes não instaladas antes de persistir uma escolha de timbre.
  def self.include?(id)
    DEFINITIONS.key?(id)
  end
end
