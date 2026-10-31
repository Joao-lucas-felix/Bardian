# Mantém os workers locais no mesmo isolamento da página de harmonia.
# Precisa envolver o servidor de arquivos estáticos, que não passa por controllers.
class AudioEngineHeaders
  # Recebe o próximo componente Rack; não altera rotas ou conteúdo.
  def initialize(app)
    @app = app
  end

  # Acrescenta a política apenas aos artefatos de áudio, preservando a resposta.
  def call(env)
    status, headers, body = @app.call(env)
    if env["PATH_INFO"].start_with?("/audio-engine/")
      headers = headers.merge("cross-origin-embedder-policy" => "require-corp",
                              "cross-origin-resource-policy" => "same-origin")
      # Entrada e WASM têm nomes estáveis; precisam revalidar após cada atualização.
      if env["PATH_INFO"] == "/audio-engine/engine.js" || env["PATH_INFO"].start_with?("/audio-engine/wasm/")
        headers["cache-control"] = "no-cache"
      end
    end
    # O SHA no caminho muda junto com o banco; respostas ausentes nunca são imutáveis.
    if status == 200 && env["PATH_INFO"].match?(%r{\A/audio/soundfonts/[0-9a-f]{64}/FluidR3_GM\.sf2\z})
      headers = headers.merge("cache-control" => "public, max-age=31536000, immutable",
                              "content-type" => "application/octet-stream")
    end
    [ status, headers, body ]
  end
end
