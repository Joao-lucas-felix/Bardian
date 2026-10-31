# Guarda a última parada visitada sem confundir visita com conclusão de aula.
class AddBardPathPositionToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :last_bard_lesson_slug, :string
  end
end
