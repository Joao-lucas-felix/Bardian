Rails.application.routes.draw do
  # Expõe os fluxos de cadastro, login e logout do modelo User.
  devise_for :users, controllers: { omniauth_callbacks: "users/omniauth_callbacks" }

  # A biblioteca autenticada é a entrada única do produto atual.
  root "compositions#index"

  # Leitura livre das aulas publicadas e conclusão individual da conta.
  get "caminho-do-bardo", to: "bard_path#index", as: :bard_path_index
  get "caminho-do-bardo/:slug", to: "bard_path#show", as: :bard_path_lesson
  post "caminho-do-bardo/:slug/visita", to: "bard_path#visit", as: :visit_bard_path_lesson
  post "caminho-do-bardo/:slug/conclusao", to: "bard_path#complete", as: :complete_bard_path_lesson

  # Lista e salva apenas composições pertencentes à conta autenticada.
  resources :compositions, only: [ :index, :new, :create, :show, :edit, :update, :destroy ] do
    post :preview, on: :collection
    get :setup, on: :member
    patch :configure, on: :member
    get :next_step, on: :member
    get :cover, on: :member
    resource :harmony, only: [ :show, :update ], controller: "composition_harmonies" do
      post :assist
      get :panel
    end
    # Analisa o documento atual sem persistir a seleção ou suas possibilidades.
    post :assistance, on: :member
  end

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
end
