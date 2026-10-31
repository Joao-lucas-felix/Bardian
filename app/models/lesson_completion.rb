# Registra quando uma conta concluiu uma aula identificada pelo catálogo.
class LessonCompletion < ApplicationRecord
  belongs_to :user

  validates :lesson_slug, presence: true
  validates :completed_at, presence: true
end
