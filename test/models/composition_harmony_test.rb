require "test_helper"

# Verifica merge real sem depender da ordem das faixas na projeção.
class CompositionHarmonyTest < ActiveSupport::TestCase
  # Faixas externas e loop precisam sobreviver mesmo sem aparecerem no editor.
  test "preserva duas faixas e dados externos com declaracao" do
    base = { "version" => 1, "id" => "song", "name" => "Teste", "bpm" => 120,
      "time_signature" => { "numerator" => 4, "denominator" => 4 }, "tracks" => [],
      "loop" => { "start_tick" => 0, "end_tick" => 960 } }
    projection = CompositionHarmony.new(base).document
    projection["harmony"] = { "blocks" => [] }
    extra = projection["tracks"][0].deep_dup
    extra["id"] = "harmony-extra-song"
    extra["regions"][0]["id"] = "extra-region"
    extra["regions"][0]["notes"] = [ { "id" => "bass", "pitch" => 48, "onset_tick" => 0, "duration_ticks" => 480, "velocity" => 90 } ]
    projection["tracks"].unshift(extra)
    result = CompositionHarmony.new(base).merge(projection)
    assert_equal base["loop"], result["loop"]
    assert_equal 2, result["tracks"].length
    assert_equal({ "blocks" => [] }, result["harmony"])
    assert_equal result, CompositionHarmony.new(result).merge(CompositionHarmony.new(result).document)
    without_extra = projection.deep_dup
    without_extra["tracks"].reject! { |track| track["id"] == extra["id"] }
    assert_raises(ArgumentError) { CompositionHarmony.new(result).merge(without_extra) }
    result["extension"] = "preserve me"
    assert_raises(ArgumentError) { CompositionHarmony.new(result).merge(projection) }
  end
end
