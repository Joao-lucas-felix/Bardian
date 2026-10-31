# Cria um documento musical versionado por usuário, salvo de forma atômica.
class CreateCompositions < ActiveRecord::Migration[8.1]
  # IDs textuais permitem usar a mesma identidade na URL e no contrato musical.
  def change
    create_table :compositions, id: :string do |t|
      t.references :user, null: false, foreign_key: true
      t.json :document, null: false
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end

    add_index :compositions, [ :user_id, :updated_at ]
  end
end
