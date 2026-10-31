require "test_helper"

class AudioEngineHeadersTest < ActiveSupport::TestCase
  # Workers precisam da política também na própria resposta HTTP, não só no HTML.
  test "isola somente artefatos do motor sonoro" do
    app = AudioEngineHeaders.new(->(_env) { [ 200, { "content-type" => "text/javascript" }, [ "worker" ] ] })
    status, headers, body = app.call("PATH_INFO" => "/audio-engine/assets/worker.js")
    assert_equal 200, status
    assert_equal "require-corp", headers["cross-origin-embedder-policy"]
    assert_equal "same-origin", headers["cross-origin-resource-policy"]
    assert_equal [ "worker" ], body
    assert_equal "no-cache", app.call("PATH_INFO" => "/audio-engine/engine.js")[1]["cache-control"]
    assert_equal "no-cache", app.call("PATH_INFO" => "/audio-engine/wasm/engine.wasm")[1]["cache-control"]
    assert_nil app.call("PATH_INFO" => "/assets/application.js")[1]["cross-origin-embedder-policy"]
  end
  # Caminho com hash permite cache longo sem prender respostas 404 no navegador.
  test "cacheia apenas soundfont versionado existente" do
    path = "/audio/soundfonts/#{'a' * 64}/FluidR3_GM.sf2"
    app = AudioEngineHeaders.new(->(_env) { [ 200, {}, [] ] })
    headers = app.call("PATH_INFO" => path)[1]
    assert_equal "public, max-age=31536000, immutable", headers["cache-control"]
    assert_equal "application/octet-stream", headers["content-type"]
    missing = AudioEngineHeaders.new(->(_env) { [ 404, {}, [] ] })
    assert_nil missing.call("PATH_INFO" => path)[1]["cache-control"]
  end
end
