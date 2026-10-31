require_relative "boot"

require "rails/all"
require_relative "../lib/audio_engine_headers"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Bardian
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1
    config.middleware.insert_before ActionDispatch::Static, AudioEngineHeaders

    # Mantém as mensagens da aplicação e da autenticação em português.
    config.i18n.default_locale = :"pt-BR"

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Código histórico fica disponível para consulta, mas não participa do autoload.
    Rails.autoloaders.main.ignore(Rails.root.join("app/legacy"))

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")
  end
end
