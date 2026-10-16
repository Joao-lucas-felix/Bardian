# Coordena o CRUD de documentos musicais da conta autenticada.
class CompositionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_composition, only: [ :show, :update, :destroy ]

  # Lista apenas composições próprias, mais recentes primeiro.
  def index
    @compositions = current_user.compositions.order(updated_at: :desc)
  end

  # Cria uma composição vazia com ID compartilhada pela URL e pelo contrato.
  def create
    id = SecureRandom.uuid
    name = params[:name].to_s.strip.presence || "Sem título"
    music = Music::Composition.new(id: id, name: name, bpm: 120,
      time_signature: { "numerator" => 4, "denominator" => 4 }, tracks: [])
    composition = current_user.compositions.create!(id: id, document: music.to_h)
    redirect_to composition_path(composition), notice: "Composição criada."
  rescue ArgumentError, ActiveRecord::RecordInvalid => error
    redirect_to compositions_path, alert: "Não foi possível criar a composição: #{error.message}"
  end

  # Exibe um resumo em HTML ou o documento completo para o futuro editor.
  def show
    respond_to do |format|
      format.html { prepare_summary }
      format.json { render json: snapshot }
    end
  end

  # Substitui o documento inteiro por JSON ou salva metadados do formulário.
  def update
    version = Integer(params[:lock_version], exception: false)
    return render_update_error("Versão de salvamento inválida.", :unprocessable_entity) if version.nil? || version.negative?
    return render_update_error("A composição mudou em outra aba. Recarregue antes de salvar.", :conflict) if version != @composition.lock_version

    document = request.format.json? ? json_document : form_document
    @composition.document = Music::Composition.from_h(document).to_h
    @composition.save!

    respond_to do |format|
      format.html { redirect_to composition_path(@composition), notice: "Composição salva." }
      format.json { render json: snapshot }
    end
  rescue ArgumentError, ActiveRecord::RecordInvalid => error
    render_update_error("Dados musicais inválidos: #{error.message}", :unprocessable_entity)
  rescue ActiveRecord::StaleObjectError
    render_update_error("A composição mudou em outra aba. Recarregue antes de salvar.", :conflict)
  end

  # Exclui somente a composição encontrada dentro do escopo do proprietário.
  def destroy
    @composition.destroy!
    redirect_to compositions_path, notice: "Composição excluída."
  end

  private

  # A busca pelo relacionamento do usuário impede acesso por ID de terceiros.
  def set_composition
    @composition = current_user.compositions.find(params[:id])
  end

  # Entrega o documento e a versão que o cliente deve enviar no próximo save.
  def snapshot
    { document: @composition.document, lock_version: @composition.lock_version }
  end

  # Aceita uma árvore JSON completa; a validação musical ocorre antes da escrita.
  def json_document
    data = params[:document]
    raise ArgumentError, "document deve ser um objeto" unless data.is_a?(ActionController::Parameters)

    data.to_unsafe_h
  end

  # Altera apenas metadados; conserva faixas, regiões e notas existentes.
  def form_document
    fields = params.require(:composition).permit(:name, :bpm, :numerator, :denominator)
    document = @composition.document.deep_dup
    document["name"] = fields[:name]&.strip
    document["bpm"] = Integer(fields[:bpm], exception: false)
    document["time_signature"] = {
      "numerator" => Integer(fields[:numerator], exception: false),
      "denominator" => Integer(fields[:denominator], exception: false)
    }
    document
  end

  # Mantém contagens fora da view e deixa o template somente com apresentação.
  def prepare_summary
    music = Music::Composition.from_h(@composition.document)
    @track_count = music.tracks.length
    @region_count = music.tracks.sum { |track| track.regions.length }
    @note_count = music.tracks.sum { |track| track.regions.sum { |region| region.notes.length } }
  end

  # Informa erros de salvamento sem substituir o documento já persistido.
  def render_update_error(message, status)
    if request.format.json?
      render json: { error: message, lock_version: @composition.lock_version }, status: status
    else
      @error = message
      prepare_summary
      render :show, status: status
    end
  end
end
