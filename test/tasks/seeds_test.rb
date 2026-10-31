require "test_helper"

# Verifica a criação segura e repetível do administrador inicial.
class SeedsTest < ActiveSupport::TestCase
  test "seed cria administrador e pode ser executado novamente" do
    email = "seed-#{SecureRandom.uuid}@example.com"
    initial_count = User.count
    run_seed(email: email, password: "senha-administrativa")

    assert_equal initial_count + 1, User.count
    admin = User.find_by!(email: email)
    assert admin.admin?
    assert admin.valid_password?("senha-administrativa")

    assert_no_difference("User.count") do
      run_seed(email: email, password: "senha-nova")
    end

    assert User.find_by!(email: email).valid_password?("senha-nova")
  end

  test "seed falha sem as duas credenciais administrativas" do
    email = "seed-#{SecureRandom.uuid}@example.com"
    assert_no_difference("User.count") do
      assert_raises(ArgumentError) do
        run_seed(email: email, password: nil)
      end
    end

    refute User.exists?(email: email)
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
