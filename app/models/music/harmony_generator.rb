# frozen_string_literal: true

module Music
  # Propõe quatro tríades diatônicas com transições simples e sorteio injetável.
  class HarmonyGenerator
    COUNT = 4
    FOLLOWING_FUNCTIONS = {
      "tonic" => %w[predominant dominant],
      "predominant" => %w[dominant tonic],
      "dominant" => %w[tonic predominant]
    }.freeze

    # Compartilha a heurística com a roda sem impor escolhas ao autor.
    def self.following_functions(function)
      FOLLOWING_FUNCTIONS.fetch(function, [])
    end

    # Recebe uma leitura validada da faixa e uma fonte com #rand para testes.
    def initialize(lane, random: Random.new)
      raise ArgumentError, "faixa inválida" unless lane.is_a?(HarmonyLane)
      raise ArgumentError, "sorteio inválido" unless random.respond_to?(:rand)

      @lane = lane
      @random = random
    end

    # Devolve opções com início temporal, sem escrever notas no documento.
    def preview(mode:)
      raise ArgumentError, "operação desconhecida" unless %i[generate continue].include?(mode)
      raise ArgumentError, "não há quatro tempos livres" unless @lane.can_append?(COUNT)

      previous = starting_option(mode)
      (0...COUNT).map do |index|
        option = if index.zero? && mode == :generate
          previous
        else
          choose_after(previous)
        end
        previous = option
        option.merge("onset_tick" => @lane.next_onset_tick + index * HarmonyLane::BEAT_TICKS)
      end
    end

    private

    # Geração começa na tônica; continuação parte da última tríade MIDI reconhecida.
    def starting_option(mode)
      if mode == :generate
        raise ArgumentError, "a faixa já possui acordes; use Continuar" unless @lane.slots.empty?

        return @lane.options.first
      end

      last = @lane.slots.last
      raise ArgumentError, "adicione um acorde antes de continuar" unless last
      raise ArgumentError, "último acorde fora do campo declarado" unless last["degree"]

      @lane.options.find { |option| option["degree"] == last["degree"] }
    end

    # Prefere o próximo papel harmônico, mas permite mais de um grau por papel.
    def choose_after(previous)
      functions = self.class.following_functions(previous.fetch("function"))
      preferred = @lane.options.select { |option| option["function"] == functions.first }
      alternatives = @lane.options.select { |option| option["function"] == functions.last }
      choices = preferred + alternatives
      choices.fetch(@random.rand(choices.length))
    end
  end
end
