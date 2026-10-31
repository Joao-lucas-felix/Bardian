# Coordena a leitura livre das aulas e a conclusão pertencente à conta atual.
class BardPathController < ApplicationController
  before_action :authenticate_user!
  before_action :load_lesson, only: [ :show, :complete, :visit ]

  # Prepara a trilha publicada e seu estado individual sem consultar o banco na view.
  def index
    catalog = BardPath::LessonCatalog.current
    lessons = catalog.published
    completed_slugs = current_user.lesson_completions.where(lesson_slug: lessons.map(&:slug)).pluck(:lesson_slug).to_set
    @trail_entries = catalog.trail.map do |lesson|
      { lesson: lesson, completed: lesson.published? && completed_slugs.include?(lesson.slug) }
    end
    # Totais consideram somente o catálogo visível; registros antigos não inflam o progresso.
    @last_visited_slug = lessons.find { |lesson| lesson.slug == current_user.last_bard_lesson_slug }&.slug
    @completed_count = @trail_entries.count { |entry| entry[:completed] }
    @next_lesson = @trail_entries.find { |entry| entry[:lesson].published? && !entry[:completed] }&.fetch(:lesson)
  end

  # Mostra qualquer aula publicada, mesmo sem concluir as anteriores.
  def show
    @completed = current_user.lesson_completions.exists?(lesson_slug: @lesson.slug)
    @examples = BardPath::LessonExamples.for(@lesson.slug)
  end

  # Cria uma única conclusão por conta e preserva a primeira data após reenvios.
  def complete
    current_user.lesson_completions.create_or_find_by!(lesson_slug: @lesson.slug) do |completion|
      completion.completed_at = Time.current
    end
    redirect_to bard_path_lesson_path(slug: @lesson.slug), notice: "Aula concluída."
  end

  # Salva somente a posição da conta autenticada; não cria conclusão.
  def visit
    current_user.update!(last_bard_lesson_slug: @lesson.slug)
    render json: { slug: @lesson.slug }
  end

  private

  # Resolve o slug no catálogo publicado antes de mostrar ou alterar progresso.
  def load_lesson
    @lesson = BardPath::LessonCatalog.current.find_published!(params[:slug])
  end
end
