Rails.application.routes.draw do
  # Expõe os fluxos de cadastro, login e logout do modelo User.
  devise_for :users

  # Reúne os caminhos principais na página inicial.
  root "pages#home"

  # Mantém a apresentação pública em uma rota própria.
  get "apresentacao", to: "pages#presentation", as: :presentation

  # Reúne componentes musicais experimentais sem misturá-los à apresentação.
  get "componentes", to: "pages#components", as: :components

  # Abre a primeira composição guiada, mantendo o protótipo independente.
  get "criar", to: "pages#compose", as: :compose

  # Abre a primeira lição independente do Caminho do Bardo.
  get "caminho-do-bardo/notas", to: "pages#notes_lesson", as: :notes_lesson

  # Lista e salva apenas composições pertencentes à conta autenticada.
  resources :compositions, only: [ :index, :create, :show, :update, :destroy ]

  # Disponibiliza a entrada da área principal do projeto.
  get "dashboard", to: "dashboard#index", as: :dashboard

  get "audio_demo/index"
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"

  get "audio_demo", to: "audio_demo#index"
end
