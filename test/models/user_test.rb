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
end
