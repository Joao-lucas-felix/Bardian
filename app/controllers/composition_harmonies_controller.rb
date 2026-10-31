# Autoriza leitura, análise e escrita da harmonia de uma composição própria.
class CompositionHarmoniesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_composition
  after_action :isolate_audio, only: :show

  # Abre a projeção guiada; a primeira gravação acontece somente pelo botão Salvar.
  def show
    @document = CompositionHarmony.new(@composition.document).document
    @state = harmony_state(@document)
    @tonics = Music::MusicalContext::TONICS
    @assist_url = assist_composition_harmony_path(@composition)
    @save_url = composition_harmony_path(@composition)
    @catalogue = HarmonyInstrumentCatalog.options
    @initial_panel = params[:panel] == "editor" ? "editor" : "guided"
    render "harmony/show"
  rescue ArgumentError => error
    redirect_to composition_path(@composition), alert: "Esta composição precisa do editor avançado: #{error.message}."
  end

  # Entrega apenas apresentação autorizada; notas e áudio permanecem no shell do navegador.
  def panel
    @panel = params[:panel]
    return head :unprocessable_entity unless %w[guided settings editor].include?(@panel)

    @tonics = Music::MusicalContext::TONICS
    if @panel == "guided"
      @document = CompositionHarmony.new(@composition.document).document
      @state = harmony_state(@document)
    end
    render "harmony/panel", layout: false
  end

  # Calcula sugestões sobre a edição atual sem persistir a prévia.
  def assist
    projected = input_document
    CompositionHarmony.new(@composition.document).merge(projected)
    lane = Music::HarmonyLane.new(Music::Composition.from_h(projected))
    preview = case params[:operation]
    when "analyze" then nil
    when "generate", "continue" then Music::HarmonyGenerator.new(lane).preview(mode: params[:operation].to_sym)
    else raise ArgumentError, "operação desconhecida"
    end
    render json: { state: harmony_state(projected), preview: preview }
  rescue ArgumentError => error
    render json: { error: error.message }, status: :unprocessable_entity
  end

  # Mescla somente a faixa guiada e contexto, recusando versões antigas de outra aba.
  def update
    version = Integer(params[:lock_version], exception: false)
    return render json: { error: "Versão de salvamento inválida." }, status: :unprocessable_entity if version.nil? || version.negative?
    return conflict if version != @composition.lock_version

    @composition.document = CompositionHarmony.new(@composition.document).merge(input_document)
    @composition.save!
    render json: { lock_version: @composition.lock_version }
  rescue ActiveRecord::StaleObjectError
    conflict
  rescue ArgumentError, ActiveRecord::RecordInvalid => error
    render json: { error: error.message }, status: :unprocessable_entity
  end

  private

  # Entrega proposta não destrutiva ao shell; nunca grava ou aplica candidatos no GET.
  def harmony_state(document)
    music = Music::Composition.from_h(document)
    state = Music::HarmonyLane.new(music).to_h
    recovery = Music::HarmonyRecovery.new(music).to_h
    state["recovery"] = recovery
    if %w[candidate ambiguous unsupported].include?(recovery["status"])
      state.merge!("can_append" => false, "can_generate" => false, "can_continue" => false)
    end
    state
  end

  # Restringe todas as ações à conta autenticada antes de ler notas ou metadados.
  def set_composition
    @composition = current_user.compositions.find(params[:composition_id])
  end

  # Exige objeto JSON; o domínio valida profundamente notas, duração e identidade.
  def input_document
    payload = params[:document]
    raise ArgumentError, "documento inválido" unless payload.is_a?(ActionController::Parameters)

    payload.to_unsafe_h
  end

  # Habilita memória compartilhada apenas nesta navegação completa do navegador.
  def isolate_audio
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
  end

  # Mantém as alterações no navegador para que o usuário decida como resolver o conflito.
  def conflict
    render json: { error: "A música mudou em outra aba. Copie suas escolhas antes de recarregar; nada foi sobrescrito." }, status: :conflict
  end
end
