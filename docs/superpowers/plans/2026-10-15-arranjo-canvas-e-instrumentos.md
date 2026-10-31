# Arranjo em Canvas e instrumentos iniciais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/criar` em quatro frases alinhadas numa linha do tempo em Canvas, com editor menor e piano, cordas e bateria audíveis.

**Architecture:** O estado MIDI e a escolha de instrumento continuam por frase no controlador de criação; Canvas é apenas uma projeção. O piano roll recebe a frase ativa e delega timbre a um módulo pequeno de áudio baseado no Tone.js já instalado. Bateria usa as alturas 36/38/42 em três linhas próprias.

**Tech Stack:** Rails 8, ERB, Stimulus, Canvas 2D, Tone.js local, testes Node `node --test` e testes Rails.

**Spec:** `docs/superpowers/specs/2026-10-15-arranjo-canvas-e-instrumentos-design.md`

## Global Constraints

- Um Trecho 1 fixo: quatro compassos em 4/4; Harmonia, Baixo, Melodia e Bateria; uma frase por camada.
- Apenas um editor aberto; estado em memória até sair ou atualizar a página; sem persistência, reprodução multifaixa, exportação ou nova dependência.
- A forma de onda é ilustrativa, derivada de MIDI, e não aparece para frase vazia.
- Piano e cordas em Harmonia/Baixo/Melodia; bateria fixa com Bumbo 36, Caixa 38 e Chimbal 42.
- O piano roll isolado em `/componentes` deve continuar funcionando.
- Toda amostra nova deve ter origem, autoria, licença e conversão documentadas; nunca substituir o timbre silenciosamente em caso de erro.
- Comentários e documentação de código em português; partials sem consultas ou regras de domínio; DevReport após implementação verificada.
- A árvore de trabalho contém mudanças preexistentes: preservar todas, registrar baseline, não usar comandos destrutivos e não incluir alterações alheias em commits.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `app/javascript/creation/phrase_waveform.js` (novo) | `drawPhraseWaveform(canvas, notes, {totalTicks, color})`: desenhar grade e onda decorativa, sem estado ou áudio. |
| `app/javascript/controllers/creation_controller.js` | Guardar `{notes, instrumentId}` por chave; abrir/fechar editor; sincronizar preview e seleção. |
| `app/views/pages/compose.html.erb` | Compor cabeçalho, régua compartilhada, camadas e template do editor. |
| `app/views/pages/_creation_layer.html.erb`, `_midi_phrase_card.html.erb` | Etiqueta de camada, seletor permitido, botão HTML de frase, Canvas e painel. |
| `app/assets/stylesheets/productivity.css` | Arranjo compacto, eixo temporal, cores, temas, foco e responsividade. |
| `app/javascript/audio/phrase_instruments.js` (novo) | `createPhraseInstrument(instrumentId)` devolve instrumento com `load()`, `trigger(pitch, durationSeconds, time)`, `dispose()`; URLs e mapeamento do kit. |
| `app/javascript/controllers/piano_roll_controller.js` | Layout de 3 linhas na bateria, viewport compacto, uso do instrumento e agendamento existente. |
| `app/views/pages/_piano_roll.html.erb` | Título, ajuda, estado e controles adequados ao instrumento/kit. |
| `app/controllers/pages_controller.rb` | Descritores estáticos das camadas e escolhas de instrumentos, sem domínio musical. |
| `public/audio/strings/*`, `public/audio/drums/*`, `public/audio/*/SOURCE.txt` | Poucas amostras locais e proveniência verificável. |
| `test/javascript/creation_controller_test.mjs`, `piano_roll_controller_test.mjs`, `phrase_waveform_test.mjs`, `phrase_instruments_test.mjs`; `test/controllers/pages_controller_test.rb` | Contratos e regressões. |

## Review Focus

1. Canvas com largura zero ou `devicePixelRatio` alto não deve lançar erro nem deslocar a régua: Task 1 testa dimensões e redimensionamento.
2. Notas simultâneas ou fora dos quatro compassos não devem criar ondas fora do clipe: Task 1 testa limites/clipping.
3. Seleção de instrumento durante áudio/carregamento pendente não deve tocar o timbre antigo: Task 3 testa geração e descarte.
4. Falha HTTP/decodificação de amostra não deve apagar notas nem anunciar reprodução: Task 3 testa erro recuperável e Task 4 verifica a página.
5. Evento MIDI de bateria com altura inválida ou nota antiga fora das três linhas não deve disparar som: Task 2 testa filtro e Task 3 testa mapeamento.

---

### Task 1: Linha do tempo e prévias Canvas

**Files:** Create `app/javascript/creation/phrase_waveform.js`, `test/javascript/phrase_waveform_test.mjs`; modify `app/javascript/controllers/creation_controller.js`, `app/views/pages/compose.html.erb`, `_creation_layer.html.erb`, `_midi_phrase_card.html.erb`, `app/assets/stylesheets/productivity.css`, `test/javascript/creation_controller_test.mjs`, `test/controllers/pages_controller_test.rb`.

**Interfaces:** Consumes eventos MIDI `{id, pitch, onset, duration, velocity}` em ticks. Produces `drawPhraseWaveform(canvas, notes, {totalTicks: 7680, color})` e preserva `creation#toggle`, `creation#notesChanged` e o contrato `piano-roll:notes-changed`.

- [ ] **Step 1: Write failing tests.** Testar quatro botões e quatro Canvas na mesma régua; frase vazia sem onda; notas em ticks 0, 1920, 7680 e simultâneas geram desenho dentro do clipe; largura zero é inócua; resize respeita `devicePixelRatio`; clique e teclado expandem o painel com `aria-expanded` correto.
- [ ] **Step 2: Run red tests.** `node --test test/javascript/phrase_waveform_test.mjs test/javascript/creation_controller_test.mjs` e `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/pages_controller_test.rb`; esperar falhas nas novas asserções.
- [ ] **Step 3: Implement minimal view and painter.** A view principal mantém a régua, partial de camada recebe `layer`/`segment`, partial de frase recebe as mesmas entradas e fornece botão HTML/Canvas decorativo. `drawPhraseWaveform` limpa o Canvas, ajusta pixels físicos e desenha barras simétricas determinísticas por distribuição temporal/intensidade, limitadas a `[0, 7680]`; o controlador redesenha ao alterar notas e ao redimensionar. Usar largura temporal comum e rolagem sincronizada, não quatro escalas independentes.
- [ ] **Step 4: Run green tests and visual check.** Mesmos comandos; conferir `/criar` em desktop/celular, dois temas, foco e alinhamento de compassos. Corrigir somente desvios desta tarefa.
- [ ] **Step 5: Commit only owned hunks/files if separable.** Verificar `git diff --cached` antes do commit; se o baseline preexistente impedir separação segura, registrar o motivo e preservar o estado sem commit.

### Task 2: Editor compacto e três linhas de bateria

**Files:** Modify `app/javascript/controllers/piano_roll_controller.js`, `app/views/pages/_piano_roll.html.erb`, `app/assets/stylesheets/productivity.css`, `app/javascript/controllers/creation_controller.js`, `test/javascript/piano_roll_controller_test.mjs`, `test/javascript/creation_controller_test.mjs`.

**Interfaces:** Consumes `data-piano-roll-instrument-id-value` e `data-piano-roll-layout-value="drums"|"pitched"`; produz snapshots MIDI no formato atual. O mapa local de bateria é `[{pitch: 42, label: "Chimbal"}, {pitch: 38, label: "Caixa"}, {pitch: 36, label: "Bumbo"}]` na ordem visual de cima para baixo.

- [ ] **Step 1: Write failing tests.** Verificar viewport melódico próximo de uma oitava com rolagem vertical, sem reduzir o alcance MIDI; bateria com exatamente três linhas, criação/seleção/remoção e cursor por teclado limitados a 36/38/42; nota antiga com outra altura é ignorada na bateria; `/componentes` preserva layout original.
- [ ] **Step 2: Run red tests.** `node --test test/javascript/piano_roll_controller_test.mjs test/javascript/creation_controller_test.mjs`; esperar falhas de layout e mapeamento.
- [ ] **Step 3: Implement minimal editor mode.** Encapsular conversão linha↔altura no piano roll; manter ticks e Score existentes. Aplicar classe de compactação apenas sob `.creation-page`, reduzir altura visível e densidade de cabeçalho/ajuda, com rolagem local. Atualizar textos do kit para nomes de peças, sem afirmar que se edita um piano de 49 teclas.
- [ ] **Step 4: Run green tests.** Mesmo comando e inspeção manual de criação, navegação por teclado, zoom e scroll em `/criar` e `/componentes`.
- [ ] **Step 5: Commit only separable owned hunks/files.** Revisar staging; não capturar alterações anteriores não relacionadas.

### Task 3: Catálogo local e reprodução por amostras

**Files:** Create `app/javascript/audio/phrase_instruments.js`, `test/javascript/phrase_instruments_test.mjs`, `public/audio/strings/*`, `public/audio/drums/*`, respectivos `SOURCE.txt`; modify `app/javascript/controllers/piano_roll_controller.js`, `app/javascript/controllers/creation_controller.js`, `app/controllers/pages_controller.rb`, `app/views/pages/_creation_layer.html.erb`, `_midi_phrase_card.html.erb`, `test/javascript/creation_controller_test.mjs`, `test/javascript/piano_roll_controller_test.mjs`, `test/controllers/pages_controller_test.rb`.

**Interfaces:** `createPhraseInstrument(instrumentId: "piano"|"strings"|"drums")` retorna `{load(): Promise<void>, trigger(pitch: number, durationSeconds: number, time: number): void, dispose(): void}`. `creation#changeInstrument` mantém o ID por frase e o passa ao editor ativo. `piano-roll` usa esse objeto tanto em `scheduleAhead` quanto em `previewPitch`.

- [ ] **Step 1: Write failing tests.** Piano usa `/audio/salamander/A4.mp3`; cordas usam amostras locais sustentadas; bateria 36/38/42 seleciona exatamente bumbo/caixa/chimbal e ignora alturas alheias; `load()` rejeitado gera estado de erro e permite nova tentativa; `dispose()` impede gatilhos atrasados. Trocar piano↔cordas preserva notas e interrompe o som anterior.
- [ ] **Step 2: Run red tests.** `node --test test/javascript/phrase_instruments_test.mjs test/javascript/creation_controller_test.mjs test/javascript/piano_roll_controller_test.mjs`; esperar falhas dos novos contratos.
- [ ] **Step 3: Acquire and record assets.** Usar amostras sustentadas da pasta oficial `Strings/Violin Section/susVib` da [VSCO 2 CE](https://github.com/sgossner/VSCO-2-CE/tree/master/Strings/Violin%20Section/susVib), distribuídas por registros próximos ao intervalo usado; usar uma amostra de `kickmic` e duas de `mid` da [Virtuosity Drums](https://github.com/sfzinstruments/virtuosity_drums/tree/master/Samples) para bumbo, caixa e chimbal fechado. Escolher até cinco raízes de cordas e uma amostra por peça; registrar no `SOURCE.txt` cada nome original, URL exata, hash, licença CC0, autoria e qualquer compressão/conversão. Não adicionar arquivos ou pacotes completos; validar tamanho, formato e decodificação antes de integrar.
- [ ] **Step 4: Implement minimal audio adapter and UI.** `createPhraseInstrument` usa Tone.Sampler para piano/cordas e players locais para o kit; carregar após gesto do usuário; manter agendamento temporal no piano roll e ignorar duração apenas no gatilho do kit. `creation#changeInstrument` aceita só piano/cordas nas três camadas melódicas; bateria permanece fixa. Ao trocar/fechar, invalidar `playbackGeneration`, parar e liberar a instância; erros tornam a reprodução repetível sem alterar notas nem usar timbre substituto.
- [ ] **Step 5: Run green tests and listen.** Repetir comandos do Step 2; ouvir notas de piano/cordas e cada peça de bateria no navegador, incluindo troca em reprodução, falha simulada de asset e tentativa posterior.
- [ ] **Step 6: Commit only separable assets and owned hunks.** Conferir licença e `git diff --cached`; preservar trabalho preexistente.

### Task 4: Integração, acessibilidade, regressão e entrega

**Files:** Modify `config/dev_reports.yml`, testes de integração afetados e somente arquivos da etapa que exigirem correções verificadas.

**Interfaces:** Consumes tarefas 1–3 completas. Produces `/criar` com uma frase audível por vez e documentação de entrega; mantém `/componentes` e rotas existentes.

- [ ] **Step 1: Add integration assertions.** Exercitar rota `/criar`, quatro camadas, régua, seletores permitidos, kit fixo, descrição de estado temporário e nomes/estados acessíveis; registrar manualmente casos de Canvas indisponível, assets ausentes e tela estreita.
- [ ] **Step 2: Run integration test.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/pages_controller_test.rb`; esperar sucesso se as tarefas 1–3 cobriram o contrato, ou falha localizada a corrigir no próximo passo.
- [ ] **Step 3: Apply only integration fixes.** Corrigir copy, estados vazios/erro/foco e transbordamento necessários; não adicionar multifaixa, persistência ou refatorações laterais. Rever views/partials quanto a regras/consultas indevidas e documentar limitações verificadas.
- [ ] **Step 4: Verify full scope.** `node --test test/javascript/*.mjs`; `PARALLEL_WORKERS=1 mise exec -- bin/rails test`; `RUBOCOP_CACHE_ROOT=/tmp/bardian-rubocop-cache mise exec -- bin/rubocop`; `git diff --check`. Conferir visual, teclado e som em `/criar` no desktop/celular e temas claro/escuro, e regressão em `/componentes`.
- [ ] **Step 5: Register DevReport and verify it.** Adicionar registro em `config/dev_reports.yml` com escopo, testes, decisões e limites reais; rodar o teste de DevReport afetado e validar YAML. Revisar diff final contra o baseline para não descartar mudanças de usuário.
- [ ] **Step 6: Commit only if safely separable and hand off.** Se arquivos misturarem mudanças antigas, não forçar commit; relatar precisamente o estado e as verificações executadas.
