# Disponibiliza a área principal do Bardian.
class DashboardController < ApplicationController
  before_action :authenticate_user!
  before_action :require_admin!

  # Renderiza a página inicial, ainda sem consultar dados ou receber parâmetros específicos.
  def index
  end
end
