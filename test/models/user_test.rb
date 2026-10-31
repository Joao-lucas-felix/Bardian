require "test_helper"

# Verifica as regras de identidade e perfil usadas pela autenticação.
class UserTest < ActiveSupport::TestCase
  test "novo usuário recebe a role comum por padrão" do
    user = User.new(email: "aluno@example.com", password: "senha-segura")

    assert user.user?
    refute user.admin?
  end

  test "role administrativa pode ser identificada" do
    user = User.new(
      email: "admin@example.com",
      password: "senha-segura",
      role: :admin
    )

    assert user.admin?
    refute user.user?
  end

  test "e-mail inválido impede a criação do usuário" do
    user = User.new(email: "sem-formato", password: "senha-segura")

    refute user.valid?
    assert user.errors.of_kind?(:email, :invalid)
  end

  test "senha curta impede a criação do usuário" do
    user = User.new(email: "aluno@example.com", password: "123")

    refute user.valid?
    assert user.errors.of_kind?(:password, :too_short)
  end

  test "não aceita uma role desconhecida" do
    assert_raises(ArgumentError) do
      User.new(email: "aluno@example.com", password: "senha-segura", role: :editor)
    end
  end

  # Simula apenas os dados de identidade recebidos do provedor externo.
  def google_auth(uid:, email:, verified: true)
    { "provider" => "google_oauth2", "uid" => uid, "info" => { "email" => email },
      "extra" => { "id_info" => { "email_verified" => verified } } }
  end

  test "google cria conta comum e reutiliza a identidade estável" do
    auth = google_auth(uid: "google-123", email: "novo@example.com")

    assert_difference("User.count", 1) do
      result = User.authenticate_with_google(auth)
      assert_nil result.error
      assert result.user.user?
      assert_equal "google-123", result.user.google_uid
    end

    assert_equal User.find_by!(google_uid: "google-123"), User.authenticate_with_google(auth).user
  end

  test "google não vincula automaticamente email de conta local" do
    local = User.create!(email: "aluno@example.com", password: "senha-segura")

    result = User.authenticate_with_google(google_auth(uid: "google-123", email: "ALUNO@example.com"))

    assert_equal :email_taken, result.error
    assert_nil local.reload.google_uid
  end

  test "conta autenticada pode vincular google explicitamente" do
    local = User.create!(email: "aluno@example.com", password: "senha-segura")

    result = User.authenticate_with_google(google_auth(uid: "google-123", email: "outro@example.com"), current_user: local)

    assert_nil result.error
    assert_equal "google-123", local.reload.google_uid
  end

  test "google não autenticado por email não verificado" do
    result = User.authenticate_with_google(google_auth(uid: "google-123", email: "novo@example.com", verified: false))

    assert_equal :unverified_email, result.error
    assert_nil result.user
  end

  test "identidade google vinculada a outra conta não muda o vínculo" do
    owner = User.create!(email: "primeiro@example.com", password: "senha-segura", google_uid: "google-123")
    local = User.create!(email: "segundo@example.com", password: "senha-segura")

    result = User.authenticate_with_google(google_auth(uid: "google-123", email: owner.email), current_user: local)

    assert_equal :identity_taken, result.error
    assert_nil local.reload.google_uid
  end

  test "identidade google ausente não cria conta" do
    assert_no_difference("User.count") do
      result = User.authenticate_with_google(google_auth(uid: "", email: "novo@example.com"))
      assert_equal :invalid_identity, result.error
    end
  end

  test "email google malformado não cria conta" do
    assert_no_difference("User.count") do
      result = User.authenticate_with_google(google_auth(uid: "google-123", email: "sem-arroba"))
      assert_equal :invalid_identity, result.error
    end
  end

  test "conta já vinculada não troca a identidade google" do
    local = User.create!(email: "aluno@example.com", password: "senha-segura", google_uid: "google-antigo")

    result = User.authenticate_with_google(google_auth(uid: "google-novo", email: local.email), current_user: local)

    assert_equal :already_linked, result.error
    assert_equal "google-antigo", local.reload.google_uid
  end
end
