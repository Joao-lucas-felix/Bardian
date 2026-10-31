require "test_helper"

# Exercita o resultado recebido do Google sem depender de credenciais externas.
class GoogleAuthenticationTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    OmniAuth.config.test_mode = true
    @previous_forgery_protection = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
  end

  teardown do
    OmniAuth.config.test_mode = false
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    ActionController::Base.allow_forgery_protection = @previous_forgery_protection
  end

  # Monta somente as informações de identidade usadas pela aplicação.
  def google_auth(uid: "google-123", email: "novo@example.com", verified: true)
    OmniAuth::AuthHash.new(provider: "google_oauth2", uid: uid,
      info: { email: email }, extra: { id_info: { email_verified: verified } })
  end

  # Entrega o retorno do provedor à rota pública de callback.
  def callback(auth, link: false)
    OmniAuth.config.mock_auth[:google_oauth2] = auth
    get compositions_path
    follow_redirect! if response.redirect?
    token = response.body[/<meta name="csrf-token" content="([^"]+)"/, 1]
    assert token.present?
    post "/users/auth/google_oauth2", params: { authenticity_token: token, link: (link ? "1" : nil) }
    follow_redirect!
  end

  test "callback cria conta comum e entra na biblioteca" do
    assert_difference("User.count", 1) { callback(google_auth) }

    assert_redirected_to compositions_path
    assert_equal "google-123", User.find_by!(email: "novo@example.com").google_uid
  end

  test "callback da identidade conhecida entra na mesma conta" do
    owner = User.create!(email: "novo@example.com", password: "senha-segura", google_uid: "google-123")

    assert_no_difference("User.count") { callback(google_auth) }

    assert_redirected_to compositions_path
    get compositions_path
    assert_response :success
    assert_equal owner.id, User.find_by!(google_uid: "google-123").id
  end

  test "conta local precisa autenticar antes de vincular google" do
    owner = User.create!(email: "novo@example.com", password: "senha-segura")

    callback(google_auth)

    assert_redirected_to new_user_session_path
    assert_nil owner.reload.google_uid
    assert_equal "Entre com sua senha e vincule o Google na sua conta.", flash[:alert]
  end

  test "conta autenticada vincula google a si mesma" do
    owner = User.create!(email: "aluno@example.com", password: "senha-segura")
    sign_in owner

    callback(google_auth, link: true)

    assert_redirected_to compositions_path
    assert_equal "google-123", owner.reload.google_uid
  end

  test "identidade de outra conta não pode ser vinculada" do
    User.create!(email: "novo@example.com", password: "senha-segura", google_uid: "google-123")
    owner = User.create!(email: "aluno@example.com", password: "senha-segura")
    sign_in owner

    callback(google_auth, link: true)

    assert_redirected_to compositions_path
    assert_nil owner.reload.google_uid
  end

  test "email não verificado é recusado" do
    assert_no_difference("User.count") { callback(google_auth(verified: false)) }

    assert_redirected_to new_user_session_path
  end

  test "callback de login iniciado antes da sessão não vincula conta autenticada" do
    owner = User.create!(email: "aluno@example.com", password: "senha-segura")
    sign_in owner

    callback(google_auth)

    assert_redirected_to compositions_path
    assert_nil owner.reload.google_uid
  end

  test "pedido de vínculo sem sessão autenticada não cria conta" do
    assert_no_difference("User.count") { callback(google_auth, link: true) }

    assert_redirected_to new_user_session_path
  end

  test "erro do provedor retorna ao login" do
    OmniAuth.config.mock_auth[:google_oauth2] = :invalid_credentials
    callback(:invalid_credentials)

    assert_redirected_to new_user_session_path
  end

  test "login e cadastro mostram opção google apenas com credenciais configuradas" do
    previous_id = ENV["GOOGLE_CLIENT_ID"]
    previous_secret = ENV["GOOGLE_CLIENT_SECRET"]
    ENV["GOOGLE_CLIENT_ID"] = "client-test"
    ENV["GOOGLE_CLIENT_SECRET"] = "secret-test"

    [ new_user_session_path, new_user_registration_path ].each do |path|
      get path
      assert_select 'form[action="/users/auth/google_oauth2"][method="post"] button', text: "Continuar com Google"
    end

    ENV.delete("GOOGLE_CLIENT_SECRET")
    get new_user_session_path
    assert_select 'form[action="/users/auth/google_oauth2"]', count: 0
  ensure
    ENV["GOOGLE_CLIENT_ID"] = previous_id
    ENV["GOOGLE_CLIENT_SECRET"] = previous_secret
  end

  test "conta local autenticada oferece vínculo google" do
    previous_id = ENV["GOOGLE_CLIENT_ID"]
    previous_secret = ENV["GOOGLE_CLIENT_SECRET"]
    ENV["GOOGLE_CLIENT_ID"] = "client-test"
    ENV["GOOGLE_CLIENT_SECRET"] = "secret-test"
    sign_in User.create!(email: "aluno@example.com", password: "senha-segura")

    get compositions_path

    assert_select 'form[action="/users/auth/google_oauth2"] button', text: "Vincular Google"
    assert_select 'form[action="/users/auth/google_oauth2"] input[name="link"][value="1"]'
  ensure
    ENV["GOOGLE_CLIENT_ID"] = previous_id
    ENV["GOOGLE_CLIENT_SECRET"] = previous_secret
  end
end
