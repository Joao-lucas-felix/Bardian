require "test_helper"

# Protege o catálogo realmente aceito na persistência, não apenas seus rótulos.
class HarmonyInstrumentCatalogTest < ActiveSupport::TestCase
  test "aceita cada timbre local e recusa identificador desconhecido" do
    assert defined?(HarmonyInstrumentCatalog), "catálogo local ainda não implementado"
    assert_equal 15, HarmonyInstrumentCatalog.options.length
    HarmonyInstrumentCatalog.options.each do |option|
      assert HarmonyInstrumentCatalog.include?(option.fetch(:id))
      assert option.fetch(:label).present?
    end
    assert HarmonyInstrumentCatalog.include?("synth")
    refute HarmonyInstrumentCatalog.include?("piano-remoto")
  end
end
