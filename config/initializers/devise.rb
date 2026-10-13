# frozen_string_literal: true

# Configura o Devise para autenticação por e-mail e senha.
# Os módulos de recuperação, confirmação, bloqueio e autenticação multifator
# permanecem fora do primeiro incremento do sistema.
Devise.setup do |config|
  # Endereço usado como remetente caso fluxos de e-mail sejam habilitados depois.
  config.mailer_sender = "noreply@bardian.local"

  # Usa o Active Record, que é o ORM adotado pelo projeto.
  require "devise/orm/active_record"

  # Normaliza o e-mail antes de localizar ou autenticar um usuário.
  config.case_insensitive_keys = [ :email ]
  config.strip_whitespace_keys = [ :email ]

  # Mantém a sessão do navegador como mecanismo padrão de autenticação.
  config.skip_session_storage = [ :http_auth ]

  # Reduz o custo do BCrypt apenas nos testes; em outros ambientes preserva
  # o custo recomendado pelo Devise para dificultar tentativas automatizadas.
  config.stretches = Rails.env.test? ? 1 : 12

  # Define a faixa aceita para senhas criadas pelo cadastro público.
  config.password_length = 6..128

  # Valida somente o formato básico do e-mail; a confirmação por mensagem
  # não está habilitada nesta etapa.
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/

  # Mantém tokens de lembrar-me inválidos depois do logout.
  config.expire_all_remember_me_on_sign_out = true
end
