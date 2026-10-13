require "test_helper"

# Verifica a criação segura e repetível do administrador inicial.
class SeedsTest < ActiveSupport::TestCase
  test "seed cria administrador e pode ser executado novamente" do
    run_seed(email: "admin@example.com", password: "senha-administrativa")

    assert_equal 1, User.count
    admin = User.find_by!(email: "admin@example.com")
    assert admin.admin?
    assert admin.valid_password?("senha-administrativa")

    assert_no_difference("User.count") do
      run_seed(email: "admin@example.com", password: "senha-nova")
    end

    assert User.find_by!(email: "admin@example.com").valid_password?("senha-nova")
  end

  test "seed falha sem as duas credenciais administrativas" do
    assert_raises(ArgumentError) do
      run_seed(email: "admin@example.com", password: nil)
    end

    assert_empty User.all
  end

  private

  # Executa o seed isolando as variáveis de ambiente usadas pelo teste.
  def run_seed(email:, password:)
    previous_email = ENV["ADMIN_EMAIL"]
    previous_password = ENV["ADMIN_PASSWORD"]
    ENV["ADMIN_EMAIL"] = email
    ENV["ADMIN_PASSWORD"] = password

    load Rails.root.join("db/seeds.rb")
  ensure
    ENV["ADMIN_EMAIL"] = previous_email
    ENV["ADMIN_PASSWORD"] = previous_password
  end
end
