module ApplicationHelper
  # Informa à apresentação se o Google foi configurado nos dois segredos do ambiente.
  # Retorna falso em instalações locais sem OAuth, preservando o login por senha.
  def google_oauth_configured?
    ENV["GOOGLE_CLIENT_ID"].present? && ENV["GOOGLE_CLIENT_SECRET"].present?
  end
end
