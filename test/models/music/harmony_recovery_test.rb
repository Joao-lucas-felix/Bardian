require "test_helper"

# Exercita candidatos pela mesma entrada JSON usada pela página, sem banco local.
class MusicHarmonyRecoveryTest < ActiveSupport::TestCase
  # O baixo extra não deve apagar a sequência nem ser duplicado na separação.
  test "recupera dez acordes e preserva baixo extra" do
    data = { "version" => 1, "id" => "song", "name" => "Teste 1", "bpm" => 120,
      "time_signature" => { "numerator" => 4, "denominator" => 4 },
      "context" => { "tonic" => "C", "mode" => "major" }, "tracks" => [] }
    data = CompositionHarmony.new(data).document
    region = data["tracks"][0]["regions"][0]
    region["duration_ticks"] = 9600
    region["notes"] = 10.times.flat_map do |i|
      [ 60, 64, 67 ].map { |pitch| { "id" => "n#{i}-#{pitch}", "pitch" => pitch, "onset_tick" => i * 960, "duration_ticks" => 960, "velocity" => 90 } }
    end
    region["notes"] << { "id" => "bass", "pitch" => 48, "onset_tick" => 0, "duration_ticks" => 480, "velocity" => 90 }
    assert defined?(Music::HarmonyRecovery), "recuperação deve existir"
    result = Music::HarmonyRecovery.new(Music::Composition.from_h(data)).to_h
    assert_equal "candidate", result["status"]
    assert_equal 10, result["blocks"].length
    assert_equal "additional", result["assignments"]["bass"]
    assert_equal 31, result["assignments"].length
    data["harmony"] = { "blocks" => result["blocks"] }
    lane = Music::HarmonyLane.new(Music::Composition.from_h(data))
    assert_equal 10, lane.slots.length
    assert_equal "C", lane.slots.first["symbol"]
    assert lane.can_append?(1)
    region["notes"].clear
    assert_equal "C", Music::HarmonyLane.new(Music::Composition.from_h(data)).slots.first["symbol"]
    data["harmony"] = { "blocks" => [] }
    assert_equal "not_needed", Music::HarmonyRecovery.new(Music::Composition.from_h(data)).to_h["status"]
  end
end
