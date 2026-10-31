require "test_helper"

# Confere os exemplos sonoros que sustentam as seis aulas seguintes.
class BardPath::LessonExamplesTest < ActiveSupport::TestCase
  # Cada aula precisa oferecer comparação audível com durações e início válidos.
  test "aulas seguintes oferecem exemplos finitos e comparaveis" do
    %w[ritmo-e-pausas compassos escuta notas oitavas primeira-ideia].each do |slug|
      examples = BardPath::LessonExamples.for(slug)
      assert_operator examples.length, :>=, 2, slug
      examples.each do |example|
        assert example.fetch(:title).present?
        assert_operator example.fetch(:beats), :>, 0
        assert_operator example.fetch(:events).length, :>, 0
        example.fetch(:events).each do |event|
          assert_operator event.fetch(:at), :>=, 0
          assert_operator event.fetch(:duration), :>, 0
          assert_operator event.fetch(:at) + event.fetch(:duration), :<=, example.fetch(:beats)
        end
      end
    end
  end

  # Uma nota longa deve manter um único ataque; duas curtas precisam de dois.
  test "ritmo distingue nota sustentada de repeticao" do
    examples = BardPath::LessonExamples.for("ritmo-e-pausas")
    assert_equal [ 0 ], examples.fetch(0).fetch(:events).map { |event| event.fetch(:at) }
    assert_equal [ 0, 1 ], examples.fetch(1).fetch(:events).map { |event| event.fetch(:at) }
  end

  # O primeiro pulso de cada compasso é a referência visível do agrupamento.
  test "compassos oferecem agrupamentos de tres e quatro" do
    examples = BardPath::LessonExamples.for("compassos")
    assert_equal [ 0, 3 ], examples.fetch(0).fetch(:events).select { |event| event[:accent] }.map { |event| event[:at] }
    assert_equal [ 0, 4 ], examples.fetch(1).fetch(:events).select { |event| event[:accent] }.map { |event| event[:at] }
  end

  # O piano é o padrão; só a comparação explícita de timbre usa som eletrônico.
  test "piano acustico e padrao das aulas com uma excecao didatica" do
    examples = BardPath::LessonExamples::EXAMPLES.values.flatten
    assert_equal [ "sine" ], examples.filter_map { |example| example[:instrument] }
    assert examples.any? { |example| example[:title] == "Timbre de piano acústico" }
  end
end
