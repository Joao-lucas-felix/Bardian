# Harmonia editável — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir durações variáveis, edição expandida da faixa harmônica e quatro timbres locais, preservando o visual aprovado e as notas do usuário.

**Architecture:** O documento musical continua como fonte de verdade. A leitura harmônica informa se a edição ainda admite blocos; dados livres válidos continuam salvos e reproduzíveis. O shell Stimulus conserva documento, histórico e áudio enquanto Turbo Frames trocam apenas a apresentação.

**Tech Stack:** Rails, Ruby via mise, ERB, Hotwire, JavaScript, openDAW instalado e Vite. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-10-20-harmonia-editavel-design.md`, aprovada pelo autor na conversa.

## Global Constraints

- Manter o JSON musical atual, com notas como fonte de verdade.
- Permitir 240, 480, 960 e 1920 ticks (½, 1, 2 e 4 tempos).
- O limite continua sendo 32 blocos, não oito compassos.
- Não quantizar, completar ou apagar notas ao alternar os painéis.
- Preservar navegação completa na entrada da página isolada e os cabeçalhos COOP/COEP.
- Não adicionar bancos externos nesta primeira implementação.
- Não inclui mixer, efeitos, bancos acústicos, exportação nova, edição multifaixas nem migração completa do editor legado.
- Comentários e documentação de funções em português; preservar mudanças existentes do autor.
- Registrar no DevReport somente comportamentos entregues e verificados.

## Review Focus

- Notas fora de ordem no JSON: ordenar somente a projeção; nenhuma nota pode desaparecer.
- Resposta atrasada de frame ou análise: jamais substituir edições locais mais recentes.
- Mudança de painel durante reprodução: manter o mesmo transporte; edição ou troca de timbre interrompe a execução antiga.
- Documentos com novos timbres abertos no legado: impedir reprodução incorreta ou fallback silencioso, sem bloquear a leitura.
- Janela baixa, zoom e toque: manter controles alcançáveis com rolagem interna e foco visível.

## Arquivos e responsabilidades

- `app/models/music/harmony_lane.rb`: estrutura da faixa, capacidade guiada e projeção dos blocos.
- `app/models/music/harmony_generator.rb`: geração existente e transições compartilhadas com recomendações.
- `app/models/composition_harmony.rb`: projeção e merge sem rejeitar notas livres válidas.
- `app/javascript/composition/harmony_draft.js`: operações imutáveis em blocos de duração variável.
- `config/harmony_instruments.json`: catálogo único de IDs, nomes e parâmetros de presets.
- `app/models/harmony_instrument_catalog.rb`: leitura/validação e opções públicas do catálogo.
- `app/audio_engine/harmony_instruments.js`: tradução dos presets para parâmetros do SDK.
- `app/audio_engine/harmony_engine.js`: execução do instrumento escolhido.
- `app/javascript/composition/opendaw_mapping.js`: transporte do ID validado para o motor.
- `app/javascript/composition/harmony_editor.js`: ponte do editor existente para o documento.
- `app/javascript/controllers/harmony_controller.js`: shell, áudio, histórico, salvamento e montagem.
- `app/controllers/composition_harmonies_controller.rb` e `config/routes.rb`: painel autenticado.
- `app/views/harmony/show.html.erb`: shell persistente e frame central.
- Partials de harmonia: apresentação de toolbar, painéis, blocos, roda e editor.
- `app/assets/stylesheets/music_workspace.css`: alturas, overflow interno e estados de recomendação.

## Task 1 — Durações e preservação da edição livre

**Files:** modificar `harmony_lane.rb`, `harmony_generator.rb`, `composition_harmony.rb`,
`harmony_draft.js`; testes `test/models/music/harmony_lane_test.rb`,
`test/models/music/harmony_generator_test.rb`,
`test/controllers/composition_harmonies_controller_test.rb`,
`test/javascript/harmony_draft_test.mjs`.

**Interfaces:**

- `HarmonyLane#guided? -> Boolean`: identifica tríades contíguas de duração permitida.
- `HarmonyLane#to_h`: acrescenta `guided`, `editing_reason`; slots acrescentam
  `duration_ticks`. Em edição livre, slots vazios e capacidades guiadas falsas.
- `next_onset_tick`: soma das durações na forma guiada; fim da região na livre.
- `resizeChord(document, index, durationTicks) -> document`: cópia com deslocamento
  dos blocos posteriores e atualização da duração da região.
- Operações existentes `appendChords`, `moveChord`, `removeChord` e
  `removeLastChord` mantêm assinaturas, mas deixam de calcular início pelo índice.

- [ ] Escrever teste “aceita duracoes variadas”: C com 240 ticks e G com 960,
  início de G em 240, próximo início em 1200 e duração da região 1200.
- [ ] Escrever teste “preserva notas livres”: remover uma voz, inserir silêncio
  ou sobrepor notas resulta em `guided == false`, sem erro de persistência.
  Pitch 128, nota fora da região e identidade divergente continuam inválidos.
- [ ] Escrever teste “ordem do JSON nao altera leitura”: embaralhar eventos
  mantém os mesmos blocos e não modifica a entrada.
- [ ] Executar os testes antes da implementação e registrar as falhas esperadas.
- [ ] Separar em `HarmonyLane` validação estrutural (uma faixa tonal, uma região
  iniciada em zero, 4/4 e contexto) da classificação guiada. Não usar resgate
  genérico de erro para mascarar documentos inválidos.
- [ ] Calcular bloco anterior pela posição na sequência, não por `onset - 480`.
  Manter cifras desconhecidas nulas; duração não altera classes de altura.
- [ ] Atualizar o gerador: novas tríades seguem com 480 ticks, começando no fim
  real da sequência; geração/continuação são recusadas na edição livre.
- [ ] Atualizar helpers JS agrupando por onset em cópias ordenadas; mutações de
  bloco recusam edição livre. Redimensionar 480→1920 desloca sucessores em 1440.
- [ ] Testar preservação de IDs/velocity/pitch, redução 1920→240, remoção,
  reordenação com durações distintas e rejeição de duração 0 ou 481.
- [ ] Executar `mise exec -- bin/rails test test/models/music/harmony_lane_test.rb test/models/music/harmony_generator_test.rb test/controllers/composition_harmonies_controller_test.rb`
  e `node --test test/javascript/harmony_draft_test.mjs`; exigir zero falhas.
- [ ] Revisar diff deste bloco sem incluir mudanças preexistentes em commits.

## Task 2 — Catálogo de timbres locais

**Files:** criar `config/harmony_instruments.json`,
`app/models/harmony_instrument_catalog.rb`, `app/audio_engine/harmony_instruments.js`,
`test/models/harmony_instrument_catalog_test.rb`,
`test/javascript/harmony_instruments_test.mjs`; modificar motor, mapeamento,
`CompositionHarmony`, testes de mapeamento e consumidores legados necessários.

**Interfaces:**

- JSON: mapa por ID, cada item com `label`, `waveform`, `attack`, `decay`,
  `sustain`, `release`, `cutoff`, `gain_db`. Sem nomes de classes do SDK no JSON musical.
- IDs: `synth` (Sintetizador suave), `harmony_pad` (Pad),
  `harmony_pluck` (Dedilhado sintético), `harmony_organ` (Órgão sintético).
- `HarmonyInstrumentCatalog.options -> Array<{id:, label:}>`;
  `.include?(id) -> Boolean`. Rails lê o JSON; Vite importa o mesmo JSON.
- `configureHarmonyInstrument(instrumentBox, instrumentId) -> void`:
  resolve waveform no enum do SDK e aplica preset validado.
- `mapHarmonyDocument` preserva `instrumentId` na faixa mapeada; nomes para
  a UI vêm do catálogo público entregue pelo controller.

- [ ] Testar que catálogo tem exatamente quatro IDs, nomes honestos, parâmetros
  finitos e envelopes válidos; `synth` continua disponível; ID desconhecido falha.
- [ ] Executar testes novos e registrar falha por ausência do catálogo.
- [ ] Criar presets iniciais (segundos/Hz/dB): suave triangle/.012/.2/.55/.18/4000/-9;
  pad saw/.25/.4/.65/.8/1800/-15;
  dedilhado triangle/.005/.18/.15/.2/5000/-9;
  órgão square/.008/.1/.8/.12/2400/-18.
  Estes são pontos de partida de engenharia sujeitos à escuta, não garantias
  de qualidade perceptiva; não adicionar efeitos.
- [ ] Aplicar ganho ao oscilador e manter volume da faixa independente.
  Configurar explicitamente polifonia e desligar segundo oscilador.
- [ ] Ampliar validação no merge e no adaptador apenas para IDs do catálogo.
- [ ] Testar play e audition com cada ID; trocar instrumento durante loading
  cancela pedido anterior. Nota e duração permanecem iguais entre timbres.
- [ ] Inspecionar UI/exportação/reprodução legadas para novos IDs. Preservar
  leitura; quando o motor antigo não suportar o ID, mostrar mensagem explícita
  de indisponibilidade e orientar o fluxo openDAW, sem imitar outro timbre.
- [ ] Executar testes do catálogo, de mapeamento, lifecycle e consumidores
  afetados; rodar `npm run build:audio`. Exigir sucesso.
- [ ] Revisar aplicação dos parâmetros contra APIs do SDK local e registrar
  escuta como pendência até a validação no navegador.

## Task 3 — Ponte com o piano roll existente

**Files:** criar `app/javascript/composition/harmony_editor.js` e
`test/javascript/harmony_editor_test.mjs`; modificar controller de harmonia,
`app/views/pages/_piano_roll.html.erb` e testes afetados.

**Interfaces:**

- `editorState(document) -> {notes, totalTicks, numerator, denominator, bpm}`:
  usa `toEditorNotes`, sem filtrar alturas válidas.
- `applyEditorNotes(document, editorNotes) -> document`: usa
  `replaceRegionNotes`; preserva região, contexto e identidade.
- O shell usa `newNoteId`, `createHistory`, `record`, `undo`, `redo` existentes.
- Eventos existentes: `piano-roll:request-note-id`, `notes-changed` e
  `notes-committed`. Uma operação confirmada produz um ponto de histórico.
- Editor inicia com `persistentMode=true`, `audioEnabled=false`; transporte
  único fica no shell e usa openDAW. Partial recebe opção explícita de transporte
  externo, para não exibir mensagem falsa sobre percussão nem controles Tone.

- [ ] Testar round-trip de notas MIDI 0 e 127, posições não quantizadas e
  duração individual; resultado deve ser idêntico ao original.
- [ ] Testar edição livre→salvar→reabrir, desfazer→guiada e refazer→livre.
- [ ] Executar os testes e registrar falhas antes de criar a ponte.
- [ ] Implementar ponte e montar editor com duração atual da região (mínimo
  atual de 480 ticks). Não estender ou truncar automaticamente a composição.
- [ ] Ligar eventos de edição ao documento do shell. `notes-changed` atualiza
  projeção/dirty e interrompe áudio antigo; `notes-committed` registra histórico
  e agenda análise. Resposta da análise usa revisão para ignorar estado antigo.
- [ ] Manter histórico ao fechar/reabrir painel; operações guiadas externas
  reiniciam o histórico de notas, evitando aplicar snapshots de outra duração.
- [ ] Testar ID global, rejeição de nota fora da região, edição durante save
  e ausência de chamadas Tone no modo de transporte externo.
- [ ] Executar testes de `harmony_editor`, `harmony_controller`, `piano_roll_controller`,
  `region_notes` e `note_history`; exigir zero falhas.

## Task 4 — Painéis Hotwire e controles compactos

**Files:** modificar rota/controller de harmonia, views compartilhadas e
`music_workspace.css`; criar `app/views/harmony/panel.html.erb`,
`_toolbar.html.erb`, `_editor_panel.html.erb`, `_settings_panel.html.erb`,
`_guided_panel.html.erb`; ampliar testes de controller e JS.

**Interfaces:**

- `GET /compositions/:composition_id/harmony/panel?panel=guided|settings|editor`
  retorna `turbo-frame#harmony-panel`; proprietário obrigatório, valor inválido
  retorna 422. Não grava nem devolve notas persistidas como nova fonte de verdade.
- `panel` recebe catálogo/tonalidades para apresentação. O shell hidrata com
  seu documento atual depois de carregar o frame.
- `harmony#panelLoaded`, `harmony#changeDuration`, `harmony#changeInstrument`,
  `harmony#openEditor`, `harmony#closeEditor` coordenam o fluxo.
- `HarmonyLane#to_h` acrescenta `recommended_indices`, com a heurística
  compartilhada do gerador; lista vazia se contexto da sequência não reconhecido.

- [ ] Testar frame autenticado, outro proprietário, nome arbitrário de partial,
  entrada com COOP/COEP e ausência de dados musicais antigos no frame.
- [ ] Testar resposta atrasada: abrir editor→ajustes rapidamente mantém último
  painel solicitado; nenhuma resposta substitui `music` do shell.
- [ ] Executar testes e registrar falhas.
- [ ] Manter header, salvar, status, transporte e catálogo fora do frame.
  Habilitar Turbo explicitamente nos links internos; navegação externa continua
  completa para garantir isolamento do motor.
- [ ] Renderizar partials por lista permitida, nunca por caminho recebido.
  Reidratar editor/controles com estado atual antes da interação.
- [ ] Manter piano roll compacto de leitura no painel guiado; botão “Editar
  composição” substitui a área central pelo editor.
- [ ] Adicionar duração ½/1/2/4 no contexto do bloco selecionado, refletindo
  `duration_ticks`. Largura proporcional: 136px por 480 ticks, mínimo 68px.
  Posições e limites de compasso vêm de ticks, não do número de blocos.
- [ ] Expor timbres salvos no seletor compacto; página pública de referência
  mantém catálogo legado e não recebe IDs incompatíveis por acidente.
- [ ] Extrair a regra de funções seguintes para um método compartilhado do
  domínio; roda recebe índices recomendados, sem teoria duplicada em JS.
- [ ] Aplicar verde discreto + “Sugerido”; contorno de seleção independente.
  Conferir contraste nos dois temas, inclusive foco e hover.
- [ ] Aplicar layout com altura disponível, `min-height:0` e overflow interno.
  Não ocultar controles em janela baixa; teclado e zoom devem alcançar painéis.
- [ ] Testar montagem repetida sem duplicar listeners ou AudioContext; falha de
  frame mantém documento, dirty e possibilidade de voltar.
- [ ] Executar testes Rails e JS afetados. Revisar ERB: nenhuma consulta,
  autorização ou identificação harmônica dentro de partials.

## Task 5 — Validação integrada e registro

**Files:** `docs/harmonia-opendaw.md`, `config/dev_reports.yml`; testes de regressão
dos blocos anteriores conforme os problemas encontrados.

- [ ] Rodar suíte Rails com `PARALLEL_WORKERS=1`, Ruby via mise e banco de teste
  separado da sessão do navegador; exigir zero falhas/erros.
- [ ] Rodar `node --test test/javascript/*.mjs`, `npm run build:audio`,
  `mise exec -- bin/rails zeitwerk:check` e `git diff --check`.
- [ ] No navegador, criar C/G, redimensionar C para 2 tempos, reordenar,
  abrir editor, criar nota não simultânea, fechar, ouvir, salvar e reabrir.
  Esperado: todas as notas preservadas, indicação “Edição livre” e operações
  guiadas indisponíveis; desfazer restaura estado guiado quando aplicável.
- [ ] Verificar execução dos quatro presets, troca durante play/loading e
  troca de painéis durante play. Diferenciar execução técnica de avaliação
  auditiva; pedir escuta do autor se áudio não puder ser avaliado diretamente.
- [ ] Inspecionar desktop e mobile numa rodada conjunta, incluindo janela baixa,
  zoom 200%, teclado, foco, rolagem interna e retorno do editor. Corrigir em
  lote os defeitos encontrados e fazer uma confirmação final.
- [ ] Revisar diff e responsabilidades; documentar limitações reais.
- [ ] Registrar no DevReport cada fluxo demonstrável entregue com rota existente.
  Não marcar etapas incompletas como prontas. Não publicar nem adicionar
  dependências fora do escopo.

## Execução proposta

Execução direta nesta tarefa, em ordem, por compartilhar documento, controller
e contrato de áudio. Revisão independente final quando houver agente disponível;
sem agente, informar que foi feita revisão própria. O plano deve ser revisado
pelo autor antes de iniciar código, conforme o fluxo de planejamento adotado.
