require "test_helper"

class AudioDemoControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get audio_demo_index_url
    assert_response :success
  end
end
