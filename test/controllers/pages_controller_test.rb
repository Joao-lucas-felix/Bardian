require "test_helper"

# Verifica o contrato entre as teclas renderizadas e o reprodutor da apresentação.
class PagesControllerTest < ActionDispatch::IntegrationTest
  test "home apresenta duas oitavas cromaticas acessiveis" do
    get root_url
    assert_response :success

    # A comparação independente detecta notas omitidas, repetidas ou na oitava errada.
    expected = %w[C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4
                  C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5]
    keys = css_select('[data-piano-target="key"]')
    assert_equal expected.sort, keys.map { |key| key["data-piano-note-param"] }.sort

    # As teclas precisam de nome e foco; o controller libera o som após carregar.
    keys.each do |key|
      assert_equal "button", key["role"]
      assert_equal "0", key["tabindex"]
      assert_equal "true", key["aria-disabled"]
      assert key["aria-label"].present?
    end
    assert_select '.story-piano[aria-hidden="true"]', count: 0
    assert_select '[data-piano-target="status"][role="status"]', count: 1
  end
end
