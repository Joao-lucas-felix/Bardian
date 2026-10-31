class User < ApplicationRecord
  # Resultado de uma autenticação: contém a conta ou um motivo de recusa.
  GoogleAuthentication = Data.define(:user, :error)

  # Mantém as composições privadas e remove seus documentos ao excluir a conta.
  has_many :compositions, dependent: :destroy

  # Remove o progresso individual ao excluir a conta, preservando aulas compartilhadas.
  has_many :lesson_completions, dependent: :destroy

  # Mantém senha e cadastro público; OmniAuth acrescenta a identidade Google.
  # Recuperação, confirmação, bloqueio e lembrar-me ficam fora deste incremento.
  devise :database_authenticatable, :registerable, :validatable,
    :omniauthable, omniauth_providers: [ :google_oauth2 ]

  # Mantém os dois perfis previstos pelo projeto em uma única tabela.
  enum :role, { user: "user", admin: "admin" }, default: :user

  # Autentica pelo ID estável do Google ou vincula à conta que iniciou o fluxo.
  # Recebe o hash verificado por OmniAuth e a conta atual opcional. Nunca associa
  # pelo e-mail uma conta local preexistente; retorna erro sem alterar a sessão.
  def self.authenticate_with_google(auth, current_user: nil)
    uid = auth["uid"].to_s
    email = auth.dig("info", "email").to_s.strip.downcase
    verified = auth.dig("extra", "id_info", "email_verified")
    return GoogleAuthentication.new(nil, :invalid_identity) if auth["provider"] != "google_oauth2" || uid.blank? || !Devise.email_regexp.match?(email)
    return GoogleAuthentication.new(nil, :unverified_email) unless verified == true || verified == "true"

    linked = find_by(google_uid: uid)
    if current_user
      return GoogleAuthentication.new(nil, :identity_taken) if linked && linked != current_user
      return GoogleAuthentication.new(nil, :already_linked) if current_user.google_uid.present? && current_user.google_uid != uid

      current_user.update!(google_uid: uid) unless linked
      return GoogleAuthentication.new(current_user, nil)
    end

    return GoogleAuthentication.new(linked, nil) if linked
    return GoogleAuthentication.new(nil, :email_taken) if where("LOWER(email) = ?", email).exists?

    user = create!(email: email, password: Devise.friendly_token(32), google_uid: uid)
    GoogleAuthentication.new(user, nil)
  end
end
