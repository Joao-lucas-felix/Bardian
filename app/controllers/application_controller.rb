class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  protected

  # Direciona cada perfil para o ponto de entrada correspondente após o login.
  # Usuários comuns permanecem na apresentação até existir uma área própria.
  def after_sign_in_path_for(resource)
    resource.admin? ? dashboard_path : root_path
  end

  # Impede que usuários autenticados sem perfil administrativo vejam a dashboard.
  # A mensagem não revela detalhes sobre a estrutura interna da autorização.
  def require_admin!
    return if current_user&.admin?

    redirect_to root_path, alert: "Acesso restrito à administração."
  end
end
