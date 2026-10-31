# Criação em camadas e frases MIDI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar `/criar` com quatro frases MIDI alinhadas ao Trecho 1; cada card abre o mesmo piano roll sob si, preserva suas próprias notas durante a visita e exibe uma prévia verdadeira.

**Architecture:** `PagesController` fornece somente descritores estáticos de apresentação. A página compõe partials de camada e card. Um controlador Stimulus da página guarda snapshots de notas por frase e monta apenas um piano roll por vez a partir de um `<template>` inerte. O controlador do piano roll recebe notas iniciais, comunica edições confirmadas e controla a disponibilidade de áudio. Não há nova entidade Ruby, banco ou dependência.

**Tech Stack:** Rails 8, Ruby, ERB, CSS, Stimulus, Canvas, Tone.js, `@webmusic/score`, Minitest e `node:test` já presentes.

**Spec:** `docs/superpowers/specs/2026-10-15-criacao-em-camadas-e-frases-design.md`

## Global Constraints

- Trecho 1 fixo, quatro compassos em 4/4, uma frase por camada: Harmonia, Baixo, Melodia, Bateria.
- Somente um editor montado por vez; mudança de frase interrompe áudio e remove listeners da instância anterior.
- Notas ficam só na memória da aba; recarregar a página as descarta. Não adicionar persistência, composição multifaixa, exportação ou novos timbres.
- Bateria permite editar, mas não reproduz nem faz prévia sonora das teclas. Explicar a limitação na interface.
- `/componentes` continua operando sem os novos atributos ou o controlador da página.
- Preservar mudanças preexistentes no worktree; inspecionar diffs antes de editar e incluir somente arquivos desta etapa em eventual commit.
- Código e documentação novos devem receber comentários/JSDoc em português conforme `AGENTS.md` §54. Revisar responsabilidades de ERB (§§54-A–54-B).
- Antes de afirmar conclusão, executar testes e conferir manualmente desktop/celular e temas. Registrar a entrega verificada em `config/dev_reports.yml`.

## Mapa de responsabilidades

- `config/routes.rb`, `app/controllers/pages_controller.rb`: rota e quatro descritores de apresentação, sem regra musical.
- `app/views/pages/compose.html.erb`: estrutura da página, aviso de não salvamento, Trecho 1 e template inerte do editor.
- `app/views/pages/_creation_layer.html.erb`, `_midi_phrase_card.html.erb`: seção e card com botão, prévia vazia e painel; locais explícitos, sem consultas.
- `app/views/pages/_piano_roll.html.erb`: editor reutilizado; locais opcionais para rótulo e áudio, defaults mantendo `/componentes`.
- `app/javascript/controllers/creation_controller.js`: estado por frase, montagem/desmontagem do editor, prévia e acessibilidade do card.
- `app/javascript/controllers/piano_roll_controller.js`: contrato de notas de entrada/saída e silenciamento completo da Bateria.
- `app/views/shared/_product_navigation.html.erb`, `app/views/pages/home.html.erb`: entrada principal para `/criar`.
- `app/assets/stylesheets/productivity.css`: hierarquia visual, card com topo arredondado e base reta, integração do editor, responsividade e foco.
- `test/controllers/pages_controller_test.rb`, `test/javascript/creation_controller_test.mjs`, `test/javascript/piano_roll_controller_test.mjs`: contratos HTTP e de interação sem dependências novas.
- `config/dev_reports.yml`: registro da entrega após verificação; ajustar apenas asserções de contagem do catálogo afetadas nos testes existentes.

## Interfaces entre tarefas

- `@creation_layers`: array de descritores com `key` (`harmony`, `bass`, `melody`, `drums`), `title`, `description`, `audio_enabled`; todos usam `segment: 1`. O controller fornece esses dados; partials recebem `layer:` e `segment:`.
- Chave da frase no DOM: `"#{layer[:key]}:#{segment}"`; botão `data-action="creation#toggle"`, `data-creation-key-param`, `aria-controls` e `aria-expanded="false"`. Painel inicia oculto e contém um destino para montar o editor. Um único `data-controller="creation"` engloba os cards e o template.
- Piano roll aceita valores Stimulus opcionais `initialNotes` (`Array` de `{id, pitch, onset, duration, velocity}`), `audioEnabled` (`Boolean`, padrão `true`) e `partName` (`String`, padrão `Piano`). Ao confirmar uma edição, despacha `piano-roll:notes-changed` com `{notes: snapshot}`. Não despacha na montagem inicial. O controlador da página escuta o evento do editor ativo.
- Snapshots são cópias de campos primitivos, nunca referências compartilhadas. O editor preserva `id` recebido e avança `nextNoteId` para não reutilizá-lo ao adicionar notas. A prévia usa `onset`/`duration` em ticks dentro de `[0, 7680]` e altura MIDI para a posição vertical; notas fora do alcance visível são limitadas apenas na projeção, não no estado musical.
- O template de `_piano_roll` deve permanecer sem controlador conectado enquanto inerte. Ao trocar de frase, remover a instância anterior antes de anexar a próxima. O controlador do piano roll deve ignorar `play`, atalhos de transporte e `previewPitch` quando `audioEnabled` for falso; o botão de reprodução também fica desativado na Bateria.

## Review Focus

1. Trocar ou fechar a frase durante reprodução deve chamar a limpeza existente e parar som/atalhos; teste de desmontagem em `creation_controller_test.mjs` e regressão de `disconnect` em `piano_roll_controller_test.mjs` (Tasks 2–3).
2. Editar Harmonia e Baixo em sequência não pode misturar notas nem perder IDs ao reabrir; teste de isolamento e reidratação no controlador de criação e no piano roll (Tasks 2–3).
3. Bateria nunca pode iniciar Tone.js, inclusive por Espaço ou clique nas teclas; testes dos três caminhos em `piano_roll_controller_test.mjs` e botão desativado no teste Rails (Task 2).
4. Prévia deve vir das notas reais, manter estado vazio correto e não ultrapassar quatro compassos; testes de projeção e recarga limpa em `creation_controller_test.mjs`/`pages_controller_test.rb` (Tasks 1 e 3).
5. Botão e painel precisam conservar `aria-expanded`, `aria-controls`, foco e um editor acessível na troca; teste do DOM no controlador de criação e conferência manual com teclado em dois tamanhos (Tasks 3–4).

---

### Task 1: Página, rota e cards sem edição

**Files:** `config/routes.rb`, `app/controllers/pages_controller.rb`, `app/views/pages/compose.html.erb` (novo), `app/views/pages/_creation_layer.html.erb` (novo), `app/views/pages/_midi_phrase_card.html.erb` (novo), `app/views/shared/_product_navigation.html.erb`, `app/views/pages/home.html.erb`, `app/assets/stylesheets/productivity.css`, `test/controllers/pages_controller_test.rb`.

**Interfaces:** Produz `compose_path`, `@creation_layers` e o HTML de cards definido acima. O botão ainda não precisa abrir editor nesta tarefa; o teste deve confirmar somente markup, dados e estado inicial. A chamada da home aponta a `/criar`; links didáticos explícitos para o protótipo podem continuar em `/componentes`.

- [ ] **Step 1: Escrever testes Rails que falham.** GET `/criar` com cabeçalho, aviso de não salvamento, Trecho 1, quatro camadas/cards, um botão e painel por card, chaves únicas, `aria-expanded=false`, `aria-controls` correspondentes e prévia vazia; navegação principal e CTA de criação apontam a `/criar`; `/componentes` permanece acessível.
- [ ] **Step 2: Executar os testes em vermelho.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/pages_controller_test.rb`; esperar falha de rota/HTML novo.
- [ ] **Step 3: Implementar rota, descritores e views.** `compose` só atribui descritores; `compose.html.erb` declara a estrutura; partials recebem apenas locais de apresentação. Incluir o template inerte de `_piano_roll` com rótulos opcionais, mas evitar uma segunda instância Stimulus montada. Documentar em português.
- [ ] **Step 4: Fazer CSS estrutural e navegação.** Quatro linhas da mesma largura temporal, cabeçalho do card com cantos superiores arredondados e inferiores retos; espaço de prévia, foco visível e layout responsivo com rolagem do editor. Usar tokens de tema existentes. Não acrescentar botões sem ação real.
- [ ] **Step 5: Executar testes Rails em verde.** Mesmo comando; conferir que os testes de `/componentes` permanecem verdes.
- [ ] **Step 6: Rever HTML/ERB e diff.** Confirmar ausência de consulta ou cálculo musical nas views; `git diff --check`; registrar o avanço sem incluir alterações alheias em commit.

### Task 2: Contrato embutível do piano roll e áudio opcional

**Files:** `app/javascript/controllers/piano_roll_controller.js`, `app/views/pages/_piano_roll.html.erb`, `test/javascript/piano_roll_controller_test.mjs`, `test/controllers/pages_controller_test.rb`.

**Interfaces:** Produz os três valores Stimulus e o evento `piano-roll:notes-changed` descritos acima. `snapshotNotes()` devolve cópias de campos primitivos; `commitScore()` reconstrói o Score e então emite o evento. Defaults conservam o editor isolado. O partial aceita locais opcionais `editor_title`, `audio_enabled`, `part_name`; por padrão funciona sem locals.

- [ ] **Step 1: Escrever testes JS/Rails que falham.** Notas iniciais reaparecem com IDs e campos intactos; novo ID não colide; edição confirmada gera evento com cópia independente; montagem não emite edição; modo sem áudio bloqueia botão, `play`, Espaço e clique no teclado sem `Tone.start`; `disconnect` encerra reprodução/listeners. Confirmar default com áudio em `/componentes`.
- [ ] **Step 2: Executar em vermelho.** `node --test test/javascript/piano_roll_controller_test.mjs` e `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/pages_controller_test.rb`; esperar apenas novos testes falharem.
- [ ] **Step 3: Implementar entrada/saída de notas.** Inicializar o editor a partir de um snapshot validado dos campos esperados, mantendo ticks e Score atuais; derivar `nextNoteId` dos IDs recebidos; emitir cópia apenas nas operações que já chamam `commitScore`; manter defaults de `/componentes`. JSDoc e comentários em português.
- [ ] **Step 4: Implementar áudio opcional.** Guardas para todas as entradas sonoras, incluindo atalhos e teclado virtual; partial desabilita reprodução para Bateria e explica que percussão ainda não está disponível. Falha de áudio em camadas tocáveis mantém edição e status explicativo.
- [ ] **Step 5: Executar testes em verde.** Repetir ambos os comandos; `git diff --check` e revisão de compatibilidade do editor isolado.

### Task 3: Expansão única, isolamento das frases e prévia real

**Files:** `app/javascript/controllers/creation_controller.js` (novo), `test/javascript/creation_controller_test.mjs` (novo), `app/views/pages/compose.html.erb`, `app/views/pages/_midi_phrase_card.html.erb`, `app/assets/stylesheets/productivity.css`, `test/controllers/pages_controller_test.rb`.

**Interfaces:** Consome o evento e os valores da Task 2; `toggle(event)` alterna um card; `notesChanged(event)` grava apenas a frase ativa; `renderPreview(key)` projeta blocos com início/largura proporcionais a 7680 ticks e estado vazio/contagem. A página usa um único template inerte e não mantém vários editores escondidos.

- [ ] **Step 1: Escrever testes JS que falham.** Abrir/fechar/trocar mantém exatamente um editor e estado ARIA coerente; desmontagem ocorre antes da nova montagem; evento de nota só altera a frase ativa; reabrir restaura os snapshots e IDs; prévia vazia e nota perto do fim do quarto compasso são corretas; IDs diferentes não se confundem; novo controlador após reload começa vazio.
- [ ] **Step 2: Executar em vermelho.** `node --test test/javascript/creation_controller_test.mjs`; esperar ausência do controlador/contrato.
- [ ] **Step 3: Implementar o controlador e conectar markup.** Map em memória por chave, clones defensivos, troca de um único editor, atributos Stimulus definidos antes do append, evento aceito somente da instância ativa, prévia baseada no mesmo snapshot. A interação usa botão nativo; manter foco previsível ao abrir/fechar. JSDoc em português.
- [ ] **Step 4: Completar aparência dos estados.** Editor encaixado sob cabeçalho reto, visual da prévia sem notas fictícias, tratamento de overflow/rolagem, estados claro/escuro e foco.
- [ ] **Step 5: Executar em verde.** `node --test test/javascript/creation_controller_test.mjs test/javascript/piano_roll_controller_test.mjs` e `PARALLEL_WORKERS=1 mise exec -- bin/rails test test/controllers/pages_controller_test.rb`; rever responsabilidades dos partials e `git diff --check`.

### Task 4: Verificação visual, regressões e registro da entrega

**Files:** `config/dev_reports.yml`, `test/models/dev_report_test.rb`, `test/controllers/dashboard_controller_test.rb` somente se asserções de contagem fixa exigirem atualização; outros arquivos da etapa apenas para correções dentro do escopo.

- [ ] **Step 1: Verificar a página em navegador.** Desktop e celular, temas claro/escuro, teclado e foco, card aberto/fechado, duas frases com notas diferentes, prévias, Bateria silenciosa, troca durante reprodução, `/componentes` preservado. Anotar limitações reais; se navegador indisponível, declarar isso.
- [ ] **Step 2: Executar suíte completa.** `PARALLEL_WORKERS=1 mise exec -- bin/rails test` e `node --test test/javascript/*.mjs`; interpretar falhas antes de corrigir, sem mudar partes não relacionadas.
- [ ] **Step 3: Executar lint e revisão final.** `mise exec -- bin/rubocop` (se disponível), `git diff --check`; confirmar contrato de eventos, cleanup, ARIA, escopo, responsividade e inexistência de lógica de domínio nas views.
- [ ] **Step 4: Registrar DevReport após verificações.** Novo registro com data, mudanças verificáveis, tags e `test_path: /criar`; atualizar apenas contagens de catálogo afetadas e executar novamente seus testes.
- [ ] **Step 5: Entregar resultado e limites.** Informar arquivos principais, comandos/resultados, decisão de áudio temporário, ausência de persistência e próximos passos possíveis. Não afirmar reprodução conjunta ou composição persistida.
