require "test_helper"

# Verifica os fluxos públicos de cadastro, login e encerramento de sessão.
class AuthenticationTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  test "formularios de acesso oferecem retorno ao inicio e a biblioteca" do
    [ new_user_session_path, new_user_registration_path ].each do |path|
      get path

      assert_response :success
      assert_select 'a[href="/"]', text: "Início"
      assert_select 'a[href="/compositions"]', text: "Minhas composições"
    end
  end

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

    assert_redirected_to compositions_path
    assert User.find_by(email: "aluno@example.com").user?
  end

  test "login com credenciais válidas cria uma sessão" do
    User.create!(email: "aluno@example.com", password: "senha-segura")

    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-segura" }
    }

    assert_redirected_to compositions_path
  end

  test "login com credenciais inválidas não autentica o usuário" do
    User.create!(email: "aluno@example.com", password: "senha-segura")

    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-incorreta" }
    }

    assert_response :success
    assert_select ".flash-alert", text: "E-mail ou senha inválidos."
    assert_select ".flash-alert[data-controller='flash'][data-flash-auto-dismiss-value='false']"
    assert_select ".flash-alert button[data-action='flash#dismiss'][aria-label='Fechar notificação']"
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

  test "login redireciona para a biblioteca" do
    User.create!(email: "aluno@example.com", password: "senha-segura")

    post user_session_path, params: {
      user: { email: "aluno@example.com", password: "senha-segura" }
    }

    assert_redirected_to compositions_path
  end
end
