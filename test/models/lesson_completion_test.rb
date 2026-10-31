require "test_helper"

# Confere que cada conclusão pertence à conta e mantém uma só marca por aula.
class LessonCompletionTest < ActiveSupport::TestCase
  # Duas contas estudam a mesma aula sem compartilhar o resultado.
  test "usuarios diferentes concluem a mesma aula separadamente" do
    first = user("primeiro")
    second = user("segundo")

    first.lesson_completions.create!(lesson_slug: "notas", completed_at: Time.current)
    second.lesson_completions.create!(lesson_slug: "notas", completed_at: Time.current)

    assert_equal 1, first.lesson_completions.count
    assert_equal 1, second.lesson_completions.count
    assert_equal 2, LessonCompletion.where(lesson_slug: "notas").count
  end

  # A restrição no banco protege também contra envios concorrentes.
  test "impede duas conclusoes da mesma aula para uma conta" do
    owner = user("unico")
    owner.lesson_completions.create!(lesson_slug: "notas", completed_at: Time.current)

    assert_raises(ActiveRecord::RecordNotUnique) do
      owner.lesson_completions.create!(lesson_slug: "notas", completed_at: Time.current)
    end
    assert_equal 1, owner.lesson_completions.count
  end

  # Excluir a conta remove o histórico individual sem deixar registros órfãos.
  test "excluir usuario remove suas conclusoes" do
    owner = user("exclusao")
    completion = owner.lesson_completions.create!(lesson_slug: "notas", completed_at: Time.current)

    owner.destroy!

    assert_not LessonCompletion.exists?(completion.id)
  end

  # A data permite mostrar quando a aula foi concluída.
  test "exige data de conclusao" do
    completion = user("data").lesson_completions.new(lesson_slug: "notas")

    assert_not completion.valid?
    assert_includes completion.errors.attribute_names, :completed_at
  end

  private

  # Cria uma conta independente para provar o isolamento de progresso.
  def user(suffix)
    User.create!(email: "bardo-#{suffix}@example.com", password: "senha-segura")
  end
end
