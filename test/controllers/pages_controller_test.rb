require "test_helper"

# Verifica os caminhos públicos e o piano interativo da apresentação.
class PagesControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  test "pagina inicial oferece aprendizagem e criacao ao visitante" do
    get root_path

    assert_response :success
    assert_select 'a[href="/apresentacao"]', text: /Apresentação/
    assert_select 'a[href="/caminho-do-bardo/notas"]', text: /Aprender música/
    assert_select 'a[href="/criar"]', text: /Criar música/
    assert_select 'a[href="/dashboard"]', count: 0
    assert_select 'nav[aria-label="Conta"] a[href="/users/sign_in"]', text: "Entrar"
    assert_select 'nav[aria-label="Conta"] a[href="/users/sign_up"]', text: "Criar conta"
    assert_select 'nav[aria-label="Conta"] form[action="/users/sign_out"]', count: 0
  end

  # A navegação deve expor os dois fluxos utilizáveis sem exigir login.
  test "navegacao global conecta aprendizagem e criacao" do
    get root_path

    assert_select 'nav[aria-label="Navegação principal"] a[href="/caminho-do-bardo/notas"]', text: /Aprender/
    assert_select 'nav[aria-label="Navegação principal"] a[href="/criar"]', text: /Criar/
    assert_select 'nav[aria-label="Navegação principal"] a[href="/dashboard"]', count: 0
    assert_select 'nav[aria-label="Navegação principal"] svg[aria-hidden="true"]', minimum: 2
  end

  test "apresentacao oferece login e cadastro ao visitante" do
    get presentation_path

    assert_response :success
    assert_select 'nav[aria-label="Conta"] a[href="/users/sign_in"]', text: "Entrar"
    assert_select 'nav[aria-label="Conta"] a[href="/users/sign_up"]', text: "Criar conta"
    assert_select 'nav[aria-label="Conta"] form[action="/users/sign_out"]', count: 0
  end

  test "apresentacao oferece dashboard e logout ao administrador" do
    sign_in User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    get presentation_path

    assert_response :success
    assert_select 'nav[aria-label="Conta"] a[href="/dashboard"]', text: "Dashboard"
    assert_select 'nav[aria-label="Conta"] form[action="/users/sign_out"] button', text: "Sair"
    assert_select 'nav[aria-label="Conta"] a[href="/users/sign_in"]', count: 0
    assert_select 'nav[aria-label="Conta"] a[href="/users/sign_up"]', count: 0
  end

  test "apresentacao nao oferece dashboard a usuario comum" do
    sign_in User.create!(email: "aluno@example.com", password: "senha-segura")

    get presentation_path

    assert_response :success
    assert_select 'nav[aria-label="Conta"] a[href="/dashboard"]', count: 0
    assert_select '.story-opening .story-button[href="/"]', text: "Voltar ao início"
    assert_select '#caminho-do-bardo .story-button[href="/"]', text: "Voltar ao início"
    assert_select 'nav[aria-label="Conta"] form[action="/users/sign_out"] button', text: "Sair"
  end

  test "pagina inicial nao indica dashboard a usuario comum" do
    sign_in User.create!(email: "aluno@example.com", password: "senha-segura")

    get root_path

    assert_response :success
    assert_select 'a[href="/dashboard"]', count: 0
  end

  test "componentes apresenta o card inicial do piano roll" do
    get components_path

    assert_response :success
    assert_select "main.components-page"
    assert_select '[data-controller="piano-roll"]'
    assert_select '[data-piano-roll-target="roll"]'
  end

  # Cada camada oferece uma frase vazia, alinhada ao mesmo trecho e acessível por botão.
  test "criacao apresenta quatro frases alinhadas e prontas para edicao" do
    get "/criar"

    assert_response :success
    assert_select "main.creation-page h1", text: /Monte sua música por partes/
    assert_select ".creation-save-note", text: /não são salvas/i
    assert_select ".creation-segment h2", text: /Trecho 1/
    assert_select ".creation-ruler", count: 1
    assert_select ".creation-ruler [data-beat='1']", count: 1
    assert_select ".creation-layer", count: 4
    assert_select ".midi-phrase-card", count: 4
    assert_select ".midi-phrase-card button[data-action='click->creation#toggle'][aria-expanded='false']", count: 4
    assert_select ".midi-phrase-preview", text: /Nenhuma nota ainda/, count: 4
    assert_select ".midi-phrase-preview canvas[aria-hidden='true']", count: 4
    keys = css_select(".midi-phrase-card button[data-creation-key-param]").map { |button| button["data-creation-key-param"] }
    assert_equal %w[harmony:1 bass:1 melody:1 drums:1], keys
    css_select(".midi-phrase-card button[aria-controls]").each do |button|
      assert_select "##{button['aria-controls']}[hidden]", count: 1
    end
    assert_select "template[data-creation-target='template']", count: 1
    assert_select ".midi-phrase-card[data-phrase-key='drums:1'][data-audio-enabled='true']", count: 1
    assert_select "select[data-action='change->creation#changeInstrument']", count: 3
    assert_select "select[data-action='change->creation#changeInstrument'] option[value='piano']", count: 3
    assert_select "select[data-action='change->creation#changeInstrument'] option[value='strings']", count: 3
    assert_select ".creation-instrument-static", text: /Bateria básica/, count: 1
  end

  test "primeira licao do caminho do bardo explica notas e piano roll" do
    get notes_lesson_path

    assert_response :success
    assert_select "main.bard-lesson-page"
    assert_select "h1", text: /Primeiras notas/
    assert_select "[data-controller='piano'][data-piano-octaves='4']", count: 1
    assert_select "[data-lesson-section='piano-roll']", count: 1
    assert_select "[data-lesson-section='next-steps']", count: 1
    assert_select "a[href='/apresentacao']", text: /Caminho do Bardo/
  end

  test "caminho do bardo oferece a primeira licao" do
    get presentation_path

    assert_response :success
    assert_select "#caminho-do-bardo a[href='/caminho-do-bardo/notas']", text: /Primeiras notas/
  end

  test "licao apresenta uma oitava cromatica de C4 a B4" do
    get notes_lesson_path

    keys = css_select("[data-piano-target='key']")
    assert_equal %w[C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4].sort,
                 keys.map { |key| key["data-piano-note-param"] }.sort
  end

  # A explicação deve ligar a escuta no piano à leitura da mesma sequência no tempo.
  test "licao conduz uma experiencia de notas ate o piano roll" do
    get notes_lesson_path

    assert_response :success
    assert_select ".lesson-piano-practice ol li", minimum: 3
    assert_select ".lesson-piano-practice details summary", text: /Conferir/
    assert_select ".lesson-piano-practice", text: /Dó4.*Ré4/m
    assert_select ".lesson-roll-example figcaption", text: /Dó4.*Ré4.*Mi4/m
    assert_select "a[href='/componentes']", text: /Experimentar no editor/
  end

  # Os nomes precisam estar visíveis para que iniciantes encontrem as teclas citadas no exercício.
  test "piano da licao identifica visualmente as teclas do exercicio" do
    get notes_lesson_path

    assert_select '[data-piano-note-param="C4"] text', text: "Dó4"
    assert_select '[data-piano-note-param="C#4"] text', text: "Dó♯4"
    assert_select '[data-piano-note-param="D4"] text', text: "Ré4"
    assert_select '[data-piano-note-param="E4"] text', text: "Mi4"
  end

  test "superficies publicas oferecem alternancia de tema" do
    get notes_lesson_path

    assert_select "[data-controller='theme']", count: 1
    assert_select "button[data-theme-target='toggle']", text: /tema escuro/i
  end

  test "piano roll apresenta a superficie musical do editor" do
    get components_path

    assert_response :success
    assert_select '[data-piano-roll-target="score"]', count: 1
    assert_select '[data-piano-roll-target="status"][role="status"]', count: 1
    assert_select '[data-action*="piano-roll#play"]', count: 1
    assert_select '[data-action*="piano-roll#stop"]', count: 1
    assert_select '[data-controller="piano-roll"][data-piano-roll-audio-enabled-value="true"]', count: 1
  end

  test "piano roll apresenta superficie de editor inspirada em uma daw" do
    get components_path

    assert_response :success
    assert_select '[data-piano-roll-target="surface"][role="application"]', count: 1
    assert_select 'canvas[data-piano-roll-target="roll"]', count: 1
    assert_select 'canvas[data-piano-roll-target="velocity"]', count: 1
    assert_select '[data-piano-roll-target="keyboard"]', count: 1
    assert_select '[data-piano-roll-target="playhead"]', count: 1
    assert_select '[data-action*="piano-roll#toggleSnap"]', count: 1
    assert_select '[data-action*="piano-roll#changeGrid"]', count: 1
    assert_select '[data-action*="piano-roll#zoom"]', minimum: 2
  end

  test "apresentacao apresenta duas oitavas cromaticas acessiveis" do
    get presentation_path
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
