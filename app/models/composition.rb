# Representa o documento persistido, sempre vinculado a uma conta.
class Composition < ApplicationRecord
  belongs_to :user

  validate :valid_music_document

  # Devolve o nome já validado para as listas sem duplicá-lo em outra coluna.
  def name
    document.is_a?(Hash) ? document["name"] : nil
  end

  private

  # O contrato de domínio valida a árvore inteira e deve coincidir com a ID da linha.
  def valid_music_document
    music = Music::Composition.from_h(document)
    errors.add(:document, "possui ID diferente da composição") unless music.id == id
  rescue ArgumentError => error
    errors.add(:document, error.message)
  end
end
