require "test_helper"

# Verifica os fluxos públicos de cadastro, login e encerramento de sessão.
class AuthenticationTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  test "cadastro público cria usuário comum mesmo com role enviada" do
    assert_difference("User.count", 1) do
      post user_registration_path, params: {
        user: {
          email: "aluno@example.com",
          password: "senha-segura",
          password_confirmation: "senha-segura",
          role: "admin"
        }
      }
    end

    assert_redirected_to root_path
    assert User.find_by(email: "aluno@example.com").user?
  end

  test "login com credenciais válidas cria uma sessão" do
    User.create!(email: "aluno@example.com", password: "senha-segura")

    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-segura" }
    }

    assert_redirected_to root_path
  end

  test "login com credenciais inválidas não autentica o usuário" do
    User.create!(email: "aluno@example.com", password: "senha-segura")

    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-incorreta" }
    }

    assert_response :success
    assert_select ".flash-alert", text: "E-mail ou senha inválidos."
    refute response.cookies.key?("remember_user_token")
  end

  test "logout encerra a sessão" do
    User.create!(email: "aluno@example.com", password: "senha-segura")
    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-segura" }
    }

    delete destroy_user_session_path

    assert_redirected_to root_path
  end

  test "visitante é encaminhado para o login ao acessar a dashboard" do
    get dashboard_path

    assert_redirected_to new_user_session_path
  end

  test "usuário comum não acessa a dashboard administrativa" do
    user = User.create!(email: "aluno@example.com", password: "senha-segura")
    sign_in user

    get dashboard_path

    assert_redirected_to root_path
    assert_equal "Acesso restrito à administração.", flash[:alert]
  end

  test "administrador acessa a dashboard administrativa" do
    admin = User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)
    sign_in admin

    get dashboard_path

    assert_response :success
    assert_select "main.dashboard-page"
  end

  test "login administrativo redireciona para a dashboard" do
    User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)

    post user_session_path, params: {
      user: { email: "admin@example.com", password: "senha-segura" }
    }

    assert_redirected_to dashboard_path
  end

  test "login comum redireciona para a página pública" do
    User.create!(email: "aluno@example.com", password: "senha-segura")

    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-segura" }
    }

    assert_redirected_to root_path
  end

  test "usuário desconectado não retorna à dashboard pelo histórico da sessão" do
    admin = User.create!(email: "admin@example.com", password: "senha-segura", role: :admin)
    sign_in admin
    delete destroy_user_session_path

    get dashboard_path

    assert_redirected_to new_user_session_path
  end
end
