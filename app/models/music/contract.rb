# frozen_string_literal: true

module Music
  # Valida os valores de entrada do contrato MIDI sem depender de Rails ou áudio.
  module Contract
    module_function

    # Obtém uma chave obrigatória de um hash serializado, rejeitando payloads incompletos.
    def required(data, key)
      raise ArgumentError, "objeto musical inválido" unless data.is_a?(Hash)
      raise ArgumentError, "campo obrigatório ausente: #{key}" unless data.key?(key)

      data[key]
    end

    # Copia uma string não vazia para impedir que o chamador altere o estado interno.
    def label(value, field)
      raise ArgumentError, "#{field} deve ser texto não vazio" unless value.is_a?(String) && !value.strip.empty?

      value.dup.freeze
    end

    # Exige um inteiro no intervalo inclusivo informado; ticks nunca são decimais.
    def integer(value, field, min:, max: nil)
      valid = value.is_a?(Integer) && value >= min && (max.nil? || value <= max)
      raise ArgumentError, "#{field} fora dos limites" unless valid

      value
    end

    # Exige um número finito no intervalo usado por BPM e volume normalizado.
    def number(value, field, min:, max: nil, exclusive_min: false)
      valid = (value.is_a?(Integer) || value.is_a?(Float)) && value.finite? &&
        (exclusive_min ? value > min : value >= min) && (max.nil? || value <= max)
      raise ArgumentError, "#{field} fora dos limites" unless valid

      value
    end

    # Exige valor booleano explícito para evitar conversão silenciosa de strings.
    def boolean(value, field)
      raise ArgumentError, "#{field} deve ser booleano" unless value == true || value == false

      value
    end

    # Confere listas de filhos e impede que um hash seja confundido com uma coleção.
    def items(value, field)
      raise ArgumentError, "#{field} deve ser uma lista" unless value.is_a?(Array)

      value
    end
  end
end
