# frozen_string_literal: true

class DeviseCreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      # Dados usados pelo módulo de autenticação por e-mail e senha.
      t.string :email, null: false, default: ""
      t.string :encrypted_password, null: false, default: ""

      # Define o perfil no banco para impedir registros sem autorização clara.
      t.string :role, null: false, default: "user"

      t.timestamps null: false
    end

    # Impede contas duplicadas para o mesmo e-mail normalizado pelo Devise.
    add_index :users, :email, unique: true
  end
end
