class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  protected

  # Direciona qualquer perfil para a biblioteca de composições após o login.
  def after_sign_in_path_for(_resource)
    compositions_path
  end

  # Mantido para controllers administrativos históricos até a remoção completa.
  # Nenhuma rota ativa utiliza esta proteção nesta versão do produto.
  def require_admin!
    return if current_user&.admin?

    redirect_to root_path, alert: "Acesso restrito à administração."
  end
end
