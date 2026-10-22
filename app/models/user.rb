class User < ApplicationRecord
  # Mantém as composições privadas e remove seus documentos ao excluir a conta.
  has_many :compositions, dependent: :destroy

  # Remove o progresso individual ao excluir a conta, preservando aulas compartilhadas.
  has_many :lesson_completions, dependent: :destroy

  # Autentica por e-mail e senha e permite o cadastro público.
  # Recuperação, confirmação, bloqueio e lembrar-me ficam fora deste incremento.
  devise :database_authenticatable, :registerable, :validatable

  # Mantém os dois perfis previstos pelo projeto em uma única tabela.
  enum :role, { user: "user", admin: "admin" }, default: :user
end
