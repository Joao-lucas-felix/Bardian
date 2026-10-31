# Vincula uma identidade Google estável a uma conta, sem usar o e-mail como chave.
class AddGoogleUidToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :google_uid, :string
    add_index :users, :google_uid, unique: true
  end
end
