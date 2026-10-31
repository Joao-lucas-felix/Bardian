# Coordena o CRUD de documentos musicais da conta autenticada.
class CompositionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_composition, only: [ :show, :edit, :cover, :update, :destroy, :assistance, :next_step, :setup, :configure ]
  after_action :isolate_audio, only: [ :new, :setup, :configure ]

  # Lista apenas composições próprias, mais recentes primeiro.
  def index
    @query = params[:q].to_s.strip.first(120)
    @sort = %w[recent name oldest].include?(params[:sort]) ? params[:sort] : "recent"
    @compositions = current_user.compositions.with_attached_cover
    @compositions = @compositions.where("json_extract(document, '$.name') LIKE ? ESCAPE '\\'", "%#{Composition.sanitize_sql_like(@query)}%") if @query.present?
    @compositions = case @sort
    when "name" then @compositions.order(Arel.sql("json_extract(document, '$.name') COLLATE NOCASE ASC"))
    when "oldest" then @compositions.order(created_at: :asc)
    else @compositions.order(updated_at: :desc)
    end
  end

  # Prepara um formulário vazio sem gravar até o envio do usuário.
  def new
    @composition = current_user.compositions.new
    @starter_values = {}
  end

  # Exibe os primeiros sons somente para uma composição ainda sem faixas.
  def setup
    return redirect_to composition_harmony_path(@composition) unless @composition.document.fetch("tracks").empty?

    @catalogue = HarmonyInstrumentCatalog.options
    @starter_values = {}
  end

  # Aplica os controles e a escolha musical ao rascunho criado na primeira página.
  def configure
    return head :conflict unless @composition.document.fetch("tracks").empty?
    version = Integer(params[:lock_version], exception: false)
    return head :conflict if version.nil? || version != @composition.lock_version

    fields = params.require(:composition).permit(:bpm, :tonic, :mode, :instrument, :preview_degrees)
    if params[:composition].key?(:preview_degrees) && !params[:composition][:preview_degrees].is_a?(String)
      raise ArgumentError, "prévia selecionada inválida"
    end
    starter = CompositionStarter.new(id: @composition.id, name: @composition.name, **starter_settings(fields))
    @composition.update!(document: starter.document(degrees: fields[:preview_degrees]))
    redirect_to composition_harmony_path(@composition), notice: "Primeiros sons definidos."
  rescue ArgumentError, ActionController::ParameterMissing, ActiveRecord::RecordInvalid => error
    @catalogue = HarmonyInstrumentCatalog.options
    @starter_values = fields || {}
    @error = "Não foi possível configurar: #{error.message}"
    render :setup, status: :unprocessable_entity
  rescue ActiveRecord::StaleObjectError
    head :conflict
  end

  # Entrega propostas transitórias para a criação; nenhuma composição é gravada.
  def preview
    fields = params.require(:composition).permit(:bpm, :tonic, :mode, :instrument)
    starter = CompositionStarter.new(id: SecureRandom.uuid, name: "Prévia", **starter_settings(fields))
    render json: { previews: starter.preview }
  rescue ArgumentError, ActionController::ParameterMissing => error
    render json: { error: error.message }, status: :unprocessable_entity
  end

  # Apresenta os caminhos disponíveis após a edição da harmonia da conta.
  def next_step; end

  # Reutiliza o formulário de metadados, mantendo notas fora desta edição.
  def edit
    @return_to_setup = params[:return_to] == "setup" && @composition.document.fetch("tracks").empty?
  end

  # Entrega a capa apenas ao proprietário, sem URL pública de armazenamento.
  def cover
    return head :not_found unless @composition.cover.attached?

    response.headers["Cache-Control"] = "private, no-store"
    send_data @composition.cover.download, type: @composition.cover.content_type,
      disposition: "inline", filename: @composition.cover.filename.to_s
  end

  # Cria uma composição vazia com ID compartilhada pela URL e pelo contrato.
  def create
    id = SecureRandom.uuid
    fields = params[:composition]&.permit(:name, :cover, :bpm, :tonic, :mode, :instrument, :preview_degrees) || params.permit(:name)
    if params[:composition]&.key?(:preview_degrees) && !params[:composition][:preview_degrees].is_a?(String)
      raise ArgumentError, "prévia selecionada inválida"
    end
    name = fields[:name].to_s.strip.presence || "Sem título"
    document = if fields.key?(:bpm) || fields.key?(:tonic) || fields.key?(:instrument)
      CompositionStarter.new(id: id, name: name, **starter_settings(fields)).document(degrees: fields[:preview_degrees])
    else
      Music::Composition.new(id: id, name: name, bpm: 120,
        time_signature: { "numerator" => 4, "denominator" => 4 }, tracks: []).to_h
    end
    @composition = current_user.compositions.new(id: id, document: document)
    @composition.cover = fields[:cover] if fields[:cover].present?
    @composition.save!
    destination = if fields.key?(:bpm)
      composition_harmony_path(@composition)
    elsif params[:composition].present?
      setup_composition_path(@composition)
    else
      composition_path(@composition)
    end
    redirect_to destination, notice: "Composição criada."
  rescue ArgumentError, ActiveRecord::RecordInvalid => error
    @composition ||= current_user.compositions.new
    @starter_values = fields || {}
    @error = "Não foi possível criar: #{error.message}"
    render :new, status: :unprocessable_entity
  end

  # Exibe um resumo em HTML ou o documento completo para o futuro editor.
  def show
    respond_to do |format|
      format.html { prepare_summary }
      format.json { render json: snapshot }
    end
  end

  # Analisa uma seleção do documento atual, inclusive edições ainda não salvas.
  def assistance
    music = Music::Composition.from_h(json_document)
    raise ArgumentError, "document possui ID diferente da composição" unless music.id == @composition.id

    result = Music::CompositionAssistant.new(music).analyze(
      track_id: params[:track_id], region_id: params[:region_id], note_ids: params[:note_ids] || [])
    render json: result
  rescue ArgumentError => error
    render json: { error: error.message }, status: :unprocessable_entity
  end

  # Substitui o documento inteiro por JSON ou salva metadados do formulário.
  def update
    version = Integer(params[:lock_version], exception: false)
    return render_update_error("Versão de salvamento inválida.", :unprocessable_entity) if version.nil? || version.negative?
    return render_update_error("A composição mudou em outra aba. Recarregue antes de salvar.", :conflict) if version != @composition.lock_version

    document = request.format.json? ? json_document : form_document
    @composition.document = Music::Composition.from_h(document).to_h
    fields = params[:composition]&.permit(:cover, :remove_cover)
    @composition.cover = fields[:cover] if fields && fields[:cover].present?
    @composition.save!
    @composition.cover.purge if fields && fields[:remove_cover] == "1" && fields[:cover].blank?

    respond_to do |format|
      format.html do
        destination = params[:return_to] == "setup" && @composition.document.fetch("tracks").empty? ? setup_composition_path(@composition) : composition_path(@composition)
        redirect_to destination, notice: "Composição salva."
      end
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

  # Mantém a leitura dos quatro controles igual na prévia e na criação definitiva.
  def starter_settings(fields)
    { bpm: fields[:bpm], tonic: fields[:tonic], mode: fields[:mode], instrument: fields[:instrument] }
  end

  # O transporte de harmonia precisa de memória isolada também na tela de prévia.
  def isolate_audio
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
  end

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
    fields = params.require(:composition).permit(:name, :bpm, :numerator, :denominator, :tonic, :mode)
    document = @composition.document.deep_dup
    document["name"] = fields[:name]&.strip
    document["bpm"] = Integer(fields[:bpm], exception: false) if fields.key?(:bpm)
    document["time_signature"] = {
      "numerator" => Integer(fields[:numerator], exception: false),
      "denominator" => Integer(fields[:denominator], exception: false)
    } if fields.key?(:numerator) || fields.key?(:denominator)
    if fields.key?(:tonic)
      if fields[:tonic].blank?
        document.delete("context")
      else
        document["context"] = { "tonic" => fields[:tonic], "mode" => fields[:mode] }
      end
    end
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
      render :edit, status: status
    end
  end
end
