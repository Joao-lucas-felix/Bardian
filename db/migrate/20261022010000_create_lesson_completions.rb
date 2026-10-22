# Guarda uma marca de conclusão por aula e por conta, sem duplicar o catálogo.
class CreateLessonCompletions < ActiveRecord::Migration[8.1]
  # A chave única mantém a conclusão idempotente mesmo em pedidos concorrentes.
  def change
    create_table :lesson_completions do |t|
      t.references :user, null: false, foreign_key: true
      t.string :lesson_slug, null: false
      t.datetime :completed_at, null: false
      t.timestamps
    end

    add_index :lesson_completions, [ :user_id, :lesson_slug ], unique: true
  end
end
