# Representa o documento persistido, sempre vinculado a uma conta.
class Composition < ApplicationRecord
  belongs_to :user
  has_one_attached :cover

  validate :valid_music_document
  validate :valid_cover

  # Devolve o nome já validado para as listas sem duplicá-lo em outra coluna.
  def name
    document.is_a?(Hash) ? document["name"] : nil
  end

  private

  # Restringe capas raster a 5 MB; SVG e outros conteúdos ativos são recusados.
  def valid_cover
    return unless cover.attached?

    errors.add(:cover, "deve ser uma imagem JPEG, PNG ou WebP") unless %w[image/jpeg image/png image/webp].include?(cover.blob.content_type)
    errors.add(:cover, "deve ter até 5 MB") if cover.blob.byte_size > 5.megabytes
  end

  # O contrato de domínio valida a árvore inteira e deve coincidir com a ID da linha.
  def valid_music_document
    music = Music::Composition.from_h(document)
    errors.add(:document, "possui ID diferente da composição") unless music.id == id
  rescue ArgumentError => error
    errors.add(:document, error.message)
  end
end
