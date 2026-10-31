# Disponibiliza a área principal do Bardian.
class DashboardController < ApplicationController
  before_action :authenticate_user!
  before_action :require_admin!

  # Apresenta entregas versionadas e filtra apenas parâmetros textuais recebidos por GET.
  # A autorização administrativa é aplicada antes da leitura do catálogo.
  def index
    all_reports = DevReport.load
    @query = params[:q].is_a?(String) ? params[:q].strip : ""
    @selected_tag = params[:tag].is_a?(String) ? params[:tag].strip : ""
    @available_tags = DevReport.tags(reports: all_reports)
    @reports = DevReport.filter(reports: all_reports, query: @query, tag: @selected_tag)
  end
end
