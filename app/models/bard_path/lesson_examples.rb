module BardPath
  # Guarda exemplos editoriais finitos; eles ilustram conceitos sem alterar composições.
  class LessonExamples
    # Cria um evento em tempos de pulso, com altura e intensidade explícitas.
    # A ausência de evento num intervalo representa silêncio no exemplo.
    def self.event(at, duration, pitch = "C4", velocity: 0.45, accent: false)
      { at: at, duration: duration, pitch: pitch, velocity: velocity, accent: accent }
    end

    # Associa cada aula a comparações fixas e auditáveis; beats é a duração total.
    EXAMPLES = {
      "ritmo-e-pausas" => [
        { title: "Uma nota por dois tempos", caption: "Dó começa no tempo 1 e permanece até o 3; o restante fica em silêncio.", beats: 4, bpm: 90, events: [ event(0, 2) ] },
        { title: "Duas notas de um tempo", caption: "Dó começa nos tempos 1 e 2. A duração ocupada é igual, mas ouvimos dois ataques.", beats: 4, bpm: 90, events: [ event(0, 1), event(1, 1) ] },
        { title: "Som, som, pausa, som", caption: "Há Dó nos tempos 1, 2 e 4; o tempo 3 é uma pausa completa.", beats: 4, bpm: 90, events: [ event(0, 1), event(1, 1), event(3, 1) ] },
        { title: "Som no meio do tempo", caption: "Os dois últimos Dós começam entre os tempos 3–4 e no 4.", beats: 4, bpm: 90, events: [ event(0, 1), event(1, 1), event(2.5, 0.5), event(3, 1) ] }
      ],
      "compassos" => [
        { title: "Dois grupos de três", caption: "Conte 1–2–3, 1–2–3; a primeira nota curta de cada grupo recebe um acento de referência.", beats: 6, bpm: 90, events: (0...6).map { |i| event(i, 0.2, "C5", velocity: i % 3 == 0 ? 0.65 : 0.3, accent: i % 3 == 0) } },
        { title: "Dois grupos de quatro", caption: "Conte 1–2–3–4, 1–2–3–4 no mesmo andamento.", beats: 8, bpm: 90, events: (0...8).map { |i| event(i, 0.2, "C5", velocity: i % 4 == 0 ? 0.65 : 0.3, accent: i % 4 == 0) } },
        { title: "Acento tocado em outra posição", caption: "A grade segue em dois grupos de quatro; a nota forte aparece no terceiro tempo de cada grupo.", beats: 8, bpm: 90, events: (0...8).map { |i| event(i, 0.2, "C5", velocity: i % 4 == 2 ? 0.65 : 0.3, accent: i % 4 == 2) } }
      ],
      "escuta" => [
        { title: "Breve", caption: "Um Dó de meio tempo.", beats: 2, bpm: 90, events: [ event(0, 0.5) ] },
        { title: "Longo", caption: "O mesmo Dó por dois tempos.", beats: 2, bpm: 90, events: [ event(0, 2) ] },
        { title: "Grave", caption: "Dó em registro mais baixo, com duração e intensidade iguais às do próximo exemplo.", beats: 2, bpm: 90, events: [ event(0, 1, "C3") ] },
        { title: "Agudo", caption: "Dó em registro mais alto.", beats: 2, bpm: 90, events: [ event(0, 1, "C5") ] },
        { title: "Suave", caption: "Dó com menor intensidade; mantenha o volume do aparelho confortável.", beats: 2, bpm: 90, events: [ event(0, 1, "C4", velocity: 0.25) ] },
        { title: "Mais forte", caption: "Mesmo Dó, agora com intensidade moderadamente maior.", beats: 2, bpm: 90, events: [ event(0, 1, "C4", velocity: 0.55) ] },
        { title: "Timbre de piano acústico", caption: "Dó tocado pelo piano acústico da aula.", beats: 2, bpm: 90, events: [ event(0, 1) ] },
        { title: "Timbre senoidal", caption: "Mesmo Dó com um som eletrônico senoidal, para comparar o timbre.", beats: 2, bpm: 90, instrument: "sine", events: [ event(0, 1) ] }
      ],
      "notas" => [
        { title: "Dó · C", caption: "Tecla branca antes do grupo de duas teclas pretas.", beats: 1, bpm: 90, events: [ event(0, 0.75, "C4") ] },
        { title: "Ré · D", caption: "Tecla branca entre as duas teclas pretas.", beats: 1, bpm: 90, events: [ event(0, 0.75, "D4") ] },
        { title: "Mi · E", caption: "Tecla branca depois do grupo de duas teclas pretas.", beats: 1, bpm: 90, events: [ event(0, 0.75, "E4") ] },
        { title: "Fá · F", caption: "Primeira tecla branca antes do grupo de três teclas pretas.", beats: 1, bpm: 90, events: [ event(0, 0.75, "F4") ] },
        { title: "Sol · G", caption: "Segunda tecla branca desse grupo.", beats: 1, bpm: 90, events: [ event(0, 0.75, "G4") ] },
        { title: "Lá · A", caption: "Terceira tecla branca desse grupo.", beats: 1, bpm: 90, events: [ event(0, 0.75, "A4") ] },
        { title: "Si · B", caption: "Tecla branca depois do grupo de três teclas pretas.", beats: 1, bpm: 90, events: [ event(0, 0.75, "B4") ] },
        { title: "Dó–Mi–Ré", caption: "Três nomes em uma ordem escolhida, sem formar uma regra de composição.", beats: 3, bpm: 90, events: [ event(0, 0.75, "C4"), event(1, 0.75, "E4"), event(2, 0.75, "D4") ] }
      ],
      "oitavas" => [
        { title: "Dó grave", caption: "Dó3, com o mesmo nome de Dó4 e altura diferente.", beats: 2, bpm: 90, events: [ event(0, 1, "C3") ] },
        { title: "Dó agudo", caption: "Dó4, uma oitava acima de Dó3 nesta convenção.", beats: 2, bpm: 90, events: [ event(0, 1, "C4") ] },
        { title: "Frase em registro grave", caption: "Dó3–Mi3–Ré3 com um tempo para cada nota.", beats: 3, bpm: 90, events: [ event(0, 0.9, "C3"), event(1, 0.9, "E3"), event(2, 0.9, "D3") ] },
        { title: "A mesma frase uma oitava acima", caption: "Dó4–Mi4–Ré4; ritmo e intensidade permanecem iguais.", beats: 3, bpm: 90, events: [ event(0, 0.9, "C4"), event(1, 0.9, "E4"), event(2, 0.9, "D4") ] }
      ],
      "primeira-ideia" => [
        { title: "Ideia inicial", caption: "Compasso 1: Dó, Ré, Mi, pausa. Compasso 2: Mi por dois tempos, Dó por dois.", beats: 8, bpm: 90, events: [ event(0, 1, "C4"), event(1, 1, "D4"), event(2, 1, "E4"), event(4, 2, "E4"), event(6, 2, "C4") ] },
        { title: "Mesma ideia uma oitava acima", caption: "Mantém inícios, durações e pausa; muda somente o registro.", beats: 8, bpm: 90, events: [ event(0, 1, "C5"), event(1, 1, "D5"), event(2, 1, "E5"), event(4, 2, "E5"), event(6, 2, "C5") ] },
        { title: "Uma escolha de ritmo diferente", caption: "O primeiro Dó dura dois tempos, Ré começa no terceiro e Mi no quarto; o segundo compasso permanece.", beats: 8, bpm: 90, events: [ event(0, 2, "C4"), event(2, 1, "D4"), event(3, 1, "E4"), event(4, 2, "E4"), event(6, 2, "C4") ] }
      ]
    }.freeze

    # Entrega os exemplos da aula solicitada; slug desconhecido não produz som.
    def self.for(slug)
      EXAMPLES.fetch(slug, [])
    end
  end
end
