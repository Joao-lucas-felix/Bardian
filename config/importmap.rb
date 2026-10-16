# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"
pin_all_from "app/javascript/creation", under: "creation"
pin_all_from "app/javascript/composition", under: "composition"
pin_all_from "app/javascript/audio", under: "audio"
# Bundle local de Tone.js 15.1.22, incluindo suas dependências de execução.
pin "tone", to: "tone.js"
pin "@webmusic/score", to: "@webmusic--score.js" # @0.2.0
pin "@webmusic/kernel/events", to: "@webmusic--kernel--events.js" # @0.2.0
pin "webmusic-score-L9U2LDTQ", to: "webmusic-score-L9U2LDTQ.js"
pin "webmusic-score-Dz8RECVT", to: "webmusic-score-Dz8RECVT.js"
pin "webmusic-kernel-BRQZ4F6N", to: "webmusic-kernel-BRQZ4F6N.js"
pin "webmusic-kernel-Qgamx4IC", to: "webmusic-kernel-Qgamx4IC.js"
