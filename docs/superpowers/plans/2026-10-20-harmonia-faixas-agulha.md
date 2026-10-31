# Harmonia, faixas e agulha — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recuperar a sequência harmônica sem perder notas, editar declaração e realização separadamente e navegar na escuta com um cursor compartilhado.

**Architecture:** O JSON versão 1 recebe `harmony.blocks` opcional, independente das notas executadas. A projeção e o merge administram somente duas faixas identificadas por ID. O shell mantém rascunho, histórico integral e cursor; o adaptador controla intenção assíncrona e o motor fornece o relógio real.

**Tech Stack:** Rails/Ruby via mise, ERB, Stimulus/Turbo, JavaScript, openDAW 0.0.174 e Vite já instalados; nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-20-harmonia-faixas-agulha-design.md`, aprovada pelo autor. Este plano aguarda revisão antes da implementação.

## Global Constraints

- 480 ticks por semínima; página de harmonia restrita a 4/4.
- Máximo de 32 blocos contíguos desde zero; durações 240, 480, 960 ou 1920.
- Qualidades `major`, `minor`, `diminished`; fundamental escrita sem oitava.
- Ausência de `harmony` é legado; `blocks: []` é declaração vazia; `null` é inválido.
- IDs únicos no documento completo; notas livres mantêm pitch 0–127 e velocity 1–127.
- Encurtar não trunca notas: bloquear se algum início deixar o bloco; permitir caudas.
- Remover bloco remove sua realização com desfazer; adicionais mantêm tempo absoluto.
- “Ouvir harmonia” toca duas faixas, sem loop; outras faixas e loop salvo são preservados.
- Retomar/seek rearticula sustentadas pela duração restante, sujeito à verificação real do SDK.
- Pré-escuta pausa a principal e preserva cursor; retomada sempre manual.
- Não incluir arpejador, mixer, efeitos, exportação, novas dependências ou migração de banco.
- Documentar classes/funções e decisões em português; explicar testes antes de criá-los.
- Preservar as muitas alterações preexistentes: registrar estado inicial e revisar somente o delta desta etapa. Não executar reset, clean ou adicionar indiscriminadamente arquivos ao Git.
- Registrar DevReport somente após entrega funcional verificada, com rota existente.

## Review Focus

- Faixas em ordem invertida e colisões com IDs externos: seleção por ID e validação após merge (tarefas 2 e 4).
- Documento explicitamente vazio reaberto: jamais reaplicar inferência (tarefas 1 e 3).
- Edição durante PATCH e resposta de sessão antiga: manter dirty correto e não tocar áudio antigo (tarefas 2 e 6).
- Nota que inicia no limite do bloco ou termina no destino do seek: associação semiaberta e nenhuma nota duplicada (tarefas 4 e 6).
- Frame reconectado, rolagem e toque cancelado: uma inscrição, uma posição musical e nenhum som após saída (tarefa 7).

## Mapa de responsabilidades

Arquivos novos são unidades pequenas com responsabilidades delimitadas; não reorganizar módulos adjacentes.

| Unidade | Arquivos principais | Responsabilidade |
| --- | --- | --- |
| Contrato | `app/models/music/harmony_block.rb` (novo), `app/models/music/composition.rb` | Identidade escrita, invariantes temporais e serialização. |
| Recuperação | `app/models/music/harmony_recovery.rb` (novo) | Propor separação não destrutiva; não salvar nem adivinhar ambiguidade. |
| Projeção e persistência | `app/models/composition_harmony.rb`, `app/controllers/composition_harmonies_controller.rb` | Duas faixas, autorização, validação e merge protegido por versão. |
| Teoria | `app/models/music/harmony_lane.rb`, `app/models/music/harmony_generator.rb` | Projetar declaração e derivar grau/função/sugestão. |
| Edição | `app/javascript/composition/harmony_draft.js`, `harmony_editor.js` | Operações imutáveis e ponte por papel da faixa. |
| Histórico | `app/javascript/composition/harmony_history.js` (novo) | Snapshots integrais e um ponto por operação confirmada. |
| Transporte | `app/javascript/composition/opendaw_mapping.js`, `app/audio_engine/harmony_engine.js`, `app/javascript/audio/opendaw_harmony.js` | Conversão, preparação, posição e cancelamento. |
| Shell | `app/javascript/controllers/harmony_controller.js`, `piano_roll_controller.js` | Rascunho, seleção, posição, montagem e gestos. |
| Apresentação | Views de harmonia/layout e CSS existentes | Régua, camadas, recuperação e largura disponível. |

## Tarefa 1 — Contrato persistido e escritores compatíveis

**Arquivos:** criar `app/models/music/harmony_block.rb` e `test/models/music/harmony_block_test.rb`; modificar `app/models/music/composition.rb`, `test/models/music/composition_test.rb`. Auditar `app/models/composition.rb`, `app/controllers/compositions_controller.rb` e `test/controllers/compositions_controller_test.rb` nos caminhos de gravação.

**Interfaces:** `Music::HarmonyBlock.from_h(hash) -> HarmonyBlock`, `#to_h -> Hash`; atributos `id`, `onset_tick`, `duration_ticks`, `chord`. `Music::Composition#harmony_blocks -> nil | Array<HarmonyBlock>` distingue legado de vazio; `initialize` recebe `harmony_blocks: nil`. Contiguidade e unicidade global pertencem à composição, não ao bloco isolado.

- [ ] Registrar baseline com `git status --short`; identificar escritores por `rg 'Composition.from_h|document\s*=|to_h' app`.
- [ ] Adicionar testes `harmony_optional_round_trip`, `rejects_invalid_harmony` e `global_block_ids`: igualdade do JSON antes/depois; ausência continua ausente; vazio continua vazio; rejeitar null, qualidade inválida, onset negativo/fracionário, duração 481, lacuna, sobreposição, ordem invertida, 33 blocos e colisão com nota externa.
- [ ] Rodar `mise exec -- bin/rails test test/models/music/composition_test.rb test/models/music/harmony_block_test.rb`; confirmar falhas das novas expectativas antes de implementar.
- [ ] Implementar o objeto e integração no serializer, preservando grafia e cópias imutáveis. Validar limites de inteiros seguros também nas somas temporais; não restringir durações de notas às durações de blocos.
- [ ] Adicionar regressão no CRUD: gravar composição com blocos, mudar nome e reabrir preservando integralmente `harmony`, loop e faixas.
- [ ] Ajustar somente escritores que perderiam os campos novos. No merge da harmonia, campos desconhecidos devem gerar erro explícito antes de passar por um serializer que os descarte (tarefa 2).
- [ ] Rodar os três arquivos de teste e `mise exec -- bin/rails zeitwerk:check`; exigir zero falhas e carregamento válido. Revisar o delta do contrato.

## Tarefa 2 — Projeção de duas faixas e gravação segura

**Arquivos:** modificar `app/models/composition_harmony.rb`, `app/controllers/composition_harmonies_controller.rb`, `test/controllers/composition_harmonies_controller_test.rb`; criar `test/models/composition_harmony_test.rb`.

**Interfaces:** manter `CompositionHarmony#document -> Hash` e `#merge(input) -> Hash`. IDs gerenciados: `harmony-<composition.id>` e `harmony-extra-<composition.id>`. A projeção contém realização e adicional se existente, sem faixas externas. PATCH continua `{document, lock_version}` e responde `{lock_version}`.

- [ ] Testar `merge_preserves_external_data`: inverter ordem das faixas, editar realização e comparar faixas externas, loop, nome, IDs e volume/mute/solo; nenhuma alteração involuntária.
- [ ] Testar `merge_rejects_loss`: ID inesperado/colidindo, remoção de adicional salva com notas, campos desconhecidos em qualquer nível, instrumento inválido, múltiplas regiões ou região gerenciada fora de zero; nenhuma gravação parcial.
- [ ] Testar `stale_save_keeps_document`: duas atualizações da mesma versão, uma salva e outra retorna 409; versão inválida retorna 422; acesso de outro usuário continua negado. Cobrir também `StaleObjectError` após a comparação inicial.
- [ ] Executar testes novos, confirmar falhas e implementar merge por ID sobre cópia da versão persistida. Preservar a adicional explicitamente vazia; criar a camada virtual somente em memória no GET.
- [ ] Validar o documento completo após merge, sem confiar na validação cliente. Limitar campos editáveis a blocos, faixas gerenciadas, BPM e contexto; conservar os demais suportados da versão persistida.
- [ ] Rodar `mise exec -- bin/rails test test/models/composition_harmony_test.rb test/controllers/composition_harmonies_controller_test.rb`; exigir zero falhas. Conferir GET sem alteração de `lock_version`.

## Tarefa 3 — Recuperação explícita e teoria pelos blocos

**Arquivos:** criar `app/models/music/harmony_recovery.rb`, `test/models/music/harmony_recovery_test.rb`, `test/fixtures/files/harmony_recovery.json`; modificar `app/models/music/harmony_lane.rb`, `harmony_generator.rb`, seus testes em `test/models/music/`, e controller de harmonia.

**Interfaces:** `Music::HarmonyRecovery.new(composition).to_h -> {status, blocks, assignments, reason}`, com chaves textuais; status `not_needed`, `empty`, `candidate`, `ambiguous` ou `unsupported`. `assignments` mapeia IDs de notas para `realization` ou `additional`. Não persiste. `HarmonyLane#to_h` mantém capacidades existentes e acrescenta ID e `chord` em cada slot; opções/prévias carregam `chord: {root, quality}` além de pitches. `next_onset_tick` usa fim declarado.

- [ ] Construir fixture sintética de 10 tríades contíguas com primeiro C4/E4/G4 de 960 ticks e C3 de 480. Testar `recovery_keeps_every_note_once`: 10 candidatos, C3 adicional, IDs e dados originais intactos.
- [ ] Testar dois conjuntos de IDs possíveis, oitava duplicada, lacuna e acorde sem grafia única: não aprovar candidato automaticamente. Testar `blocks: []` como `not_needed`, sem reinferência.
- [ ] Rodar `mise exec -- bin/rails test test/models/music/harmony_recovery_test.rb test/models/music/harmony_lane_test.rb test/models/music/harmony_generator_test.rb`; observar falhas novas.
- [ ] Implementar busca conservadora: agrupar por início/duração, reconhecer tríades pelas regras compartilhadas, exigir sequência completa única e interromper ao comprovar ambiguidade. Contexto fornece grafia apenas se única.
- [ ] Migrar leitura de slots/sugestões para declarações. Testar C arpejado e C sem notas permanecendo C; mudança de tonalidade altera grau/função sem tocar notas; fora do campo mantém cifra e permite append.
- [ ] Disponibilizar recuperação separada da análise comum. A confirmação manual deve fornecer blocos válidos e partição completa dos IDs; nenhum GET ou análise salva o resultado.
- [ ] Reexecutar os testes e os de controller da tarefa 2. Registrar entrega funcional somente após integração com confirmação visual na tarefa 5.

## Tarefa 4 — Operações atômicas e histórico integral

**Arquivos:** modificar `app/javascript/composition/harmony_draft.js`, `harmony_editor.js`, seus testes e `test/javascript/helpers/harmony_editor.mjs`; criar `app/javascript/composition/harmony_history.js`, `test/javascript/harmony_history_test.mjs`. Preservar `note_history.js` para consumidores antigos.

**Interfaces:** `moveChord(document, blockId, targetIndex)`, `resizeChord(document, blockId, durationTicks)`, `removeChord(document, blockId)` retornam cópias; `appendChords(document, chords, idFactory)` cria bloco e notas atomicamente. `editorState(document, role)` e `applyEditorNotes(document, notes, role)` usam `role = realization | additional`. `applyRecovery(document, blocks, assignments, idFactory)` em `harmony_draft.js` retorna documento separado sem modificar entrada. Histórico exporta `createHistory(document)`, `record(history, document)`, `undo(history)`, `redo(history)`; últimos retornam `{history, document, changed}` com cópias.

- [ ] Escrever testes `resize_rejects_orphan_start`, `moves_internal_offsets` e `remove_preserves_additional`: nota em 720 bloqueia 960→480, input permanece idêntico; nota em 0/duração 960 permanece; mover preserva offset, ID, pitch e velocity; excluir fecha espaço apenas na realização.
- [ ] Testar exatamente no fim do bloco, lote acima de 32 e falha de geração de ID: nenhum estado parcial. Seleção usa ID estável após reorder.
- [ ] Testar recuperação confirmada→undo→redo com igualdade integral e cada nota exatamente uma vez; nova edição invalida redo.
- [ ] Executar `node --test test/javascript/harmony_draft_test.mjs test/javascript/harmony_editor_test.mjs test/javascript/harmony_history_test.mjs`; confirmar falhas antes de implementar.
- [ ] Capturar associação das notas antes de qualquer deslocamento, recalcular blocos e aplicar deltas a cópias. Recalcular duração das regiões cobrindo notas e blocos; região vazia conserva duração técnica positiva.
- [ ] Implementar camada adicional virtual; primeiro conteúdo cria faixa/região com IDs novos e timbre atual. Edição fora de blocos na realização é recusada, na adicional é permitida. Preservar notas não quantizadas.
- [ ] Implementar histórico por operação completa; manter rascunho inicial do gesto para cancelamento e um único registro ao finalizar.
- [ ] Reexecutar testes acima e `node --test test/javascript/region_notes_test.mjs test/javascript/note_history_test.mjs`; revisar mudança de assinatura de todos os chamadores antes de integrar.

## Tarefa 5 — Integração do editor, recuperação e salvamento

**Arquivos:** modificar `app/javascript/controllers/harmony_controller.js`, `piano_roll_controller.js`, `test/javascript/harmony_controller_test.mjs`, `piano_roll_controller_test.mjs`, `app/views/harmony/_editor_panel.html.erb`, `_piano_roll_editor.html.erb`; criar `app/views/harmony/_recovery.html.erb`. Ajustar `config/importmap.rb` somente se o pin existente não abranger módulo novo.

**Interfaces:** shell conserva `music`, `editRevision`, `selectedBlockId`, `activeRole` e histórico da tarefa 4. Eventos do piano roll preservam nomes existentes; o shell valida origem/instância/camada do editor antes de aplicar notas. Confirmação de recuperação chama `applyRecovery`; depois a gravação usa PATCH existente.

- [ ] Testar troca de camada com evento atrasado do editor anterior: não editar a camada nova; trocar painel preserva rascunho e histórico. C3 adicional não desabilita adicionar acorde.
- [ ] Testar PATCH pendente seguido de edição: resposta atualiza versão, mas mantém dirty; 409, erro de rede, 401 ou HTML no lugar de JSON conservam rascunho e mensagem útil. Análise atrasada não substitui estado recente.
- [ ] Executar `node --test test/javascript/harmony_controller_test.mjs test/javascript/piano_roll_controller_test.mjs` e observar falhas novas.
- [ ] Integrar operações por ID, história integral, recuperação automática proposta e formulário manual de declaração/associação. Desabilitar ações por bloco até confirmação; cancelar não modifica notas.
- [ ] Renderizar `Acorde declarado`, `Notas editadas` por conjunto de classes e `Sem notas na realização`. Comparação ignora adicionais, oitava e ordem; nunca inventar função.
- [ ] Manter timbres distintos ao abrir documento existente; mostrar estado misto. Escolha explícita de timbre atualiza ambas as faixas e invalida áudio antigo.
- [ ] Reexecutar testes JS e controller Rails; verificar recuperação→adicionar→salvar→reabrir com todas as notas. Não marcar etapa concluída se recuperação manual ainda não for utilizável.

## Tarefa 6 — Motor, pausa, seek e concorrência

**Arquivos:** modificar `app/javascript/composition/opendaw_mapping.js`, `app/audio_engine/harmony_engine.js`, `app/javascript/audio/opendaw_harmony.js`, `test/javascript/opendaw_mapping_test.mjs`, `opendaw_lifecycle_test.mjs`; registrar evidência em `docs/harmonia-opendaw.md`.

**Interfaces:** preservar `mapHarmonyDocument(document, ppqn, instrumentIds)` retornando `{bpm, tracks, end}` com fim em PPQN. Motor expõe `prepare(document, {onPosition, onEnded})`, `play()`, `pause()`, `seek(tick)`, `stop()`, `dispose()`; borda pública usa ticks do documento. Adaptador mantém `play(document)`, `audition(document, pitches)`, `update(document)`, `stop()`, `dispose()` e acrescenta `pause()`, `seek(tick)`. `onState` retorna `{status, positionTick}`; status `loading|playing|paused|stopped|error`. Conversão PPQN fica na borda do motor, não no controller.

- [ ] Antes de alterar o motor, inspecionar `node_modules/@opendaw/studio-core/dist/EngineFacade.*` e fluxo de eventos instalados; verificar em navegador real uma nota de 1920 ticks, pausa/seek em 960 e fim em 1920. Registrar se há novo ataque, duração restante e ausência de nota presa. A presença de `setPosition`/`stop(reset)` já foi constatada, mas não prova semântica sonora.
- [ ] Se o SDK não cumprir rearticulação, interromper somente essa parte e apresentar alternativa ao autor; não substituir por comportamento silenciosamente diferente nem adicionar dependência.
- [ ] Testar mapeamento de duas faixas em ordem invertida, bloco sem notas e adicional terminando depois da tríade: `end` cobre blocos/notas, não padding técnico. PPQN 480 e 960 convertem o mesmo tick; velocity 0 é rejeitada.
- [ ] Testar lifecycle com promessas controladas: play→stop durante load, seek→seek durante load, edição, falha seguida de retry, dispose durante load e callback de fim antigo. Somente última intenção publica estado.
- [ ] Rodar `npm run test:audio`; confirmar falhas novas. Implementar preparação separada de reprodução; pause conserva sessão, stop cancela intenção e zera cursor, edição invalida sessão sem auto-retomar.
- [ ] Implementar seek limitado ao fim e pausa com corte dos eventos antigos. Testar nota que termina no destino não toca, nota que começa ali toca uma vez, nota atravessada rearticula pelo restante; fim dispara uma vez, play no fim inicia zero.
- [ ] Isolar pré-escuta: pausar principal, manter seu cursor e reconstruir apenas o material de prévia. Se a sessão principal precisar ser preparada novamente após prévia, fazê-lo somente na retomada manual; callbacks de prévia não publicam posição principal.
- [ ] Garantir liberação idempotente de observers, recursos e contexto; ignorar callbacks obsoletos mesmo quando a promise não aceita abort.
- [ ] Rodar `npm run test:audio` e `npm run build:audio`, exigir sucesso; repetir cenário sustentado com SDK real e registrar evidência/limitações auditivas.

## Tarefa 7 — Agulha, layout e ciclo de vida da página

**Arquivos:** modificar controllers e testes da tarefa 5; `app/views/harmony/show.html.erb`, `_lane.html.erb`, `_toolbar.html.erb`, `_editor_panel.html.erb`, `_piano_roll_editor.html.erb`; `app/views/layouts/application.html.erb`, `app/views/shared/_product_navigation.html.erb`; `app/assets/stylesheets/productivity.css`, `music_workspace.css`; testes Rails de harmonia e `test/controllers/composition_library_test.rb`.

**Interfaces:** shell mantém `positionTick`; representações recebem tick e escala própria. Toolbar recebe estado/transporte/catálogo, lane recebe blocos e extensão, editor recebe camada ativa e configuração. O frame hidrata rascunho atual; nunca é proprietário do áudio. Régua acessível expõe mínimo 0, máximo fim e texto compasso/tempo.

- [ ] Testar régua rolada e com teclado lateral: clique aponta o tick correto; resize/zoom mantém tick; setas movem 120, Home zero, End fim. Cancelar ponteiro restaura início do gesto. Não confundir gesto de agulha com mover nota/bloco.
- [ ] Testar Espaço em input, select, botão, link, contenteditable e descendentes, evento consumido, modificadores e repetição: nenhum toggle indevido. Fora desses casos, alternar uma vez.
- [ ] Testar duas reconexões e frame reaberto: um transporte/handler, rascunho preservado, dispose no disconnect/before-cache e nenhum reinício automático.
- [ ] Rodar testes JS da tarefa 5 e Rails das páginas afetadas; confirmar falhas novas antes de implementar.
- [ ] Colocar agulha da sequência fora dos frames, na mesma escala proporcional dos blocos; não contar gaps/cabeçalhos como tempo. Adicionar cauda navegável após último bloco quando notas terminam depois.
- [ ] Sincronizar editor pelo tick observado no motor; suspender auto-scroll durante gesto manual, sem rolar a página inteira. Não usar frames visuais como relógio musical.
- [ ] Aplicar layout sem sidebar apenas à harmonia; manter volta, título, salvamento, tema/conta e COOP/COEP. Toolbar usa `Ouvir harmonia`.
- [ ] Recuperar somente CSS estrutural necessário ao piano roll ativo, adaptado aos temas. Camadas têm rótulos, além de cor; controles acessíveis em janela baixa e celular.
- [ ] Revisar ERB: partials recebem dados preparados; nenhuma consulta, autorização ou inferência musical na view. Executar testes afetados e verificar renderização real desktop/celular, dois temas e teclado.

## Tarefa 8 — Validação integrada e entrega

**Arquivos:** atualizar `docs/contrato-musical-mvp1.md`, `docs/dominio-musical.md`, `docs/harmonia-opendaw.md`, `config/dev_reports.yml`; ajustar testes das tarefas anteriores somente para defeitos encontrados.

- [ ] Executar `PARALLEL_WORKERS=1 mise exec -- bin/rails test`, `node --test test/javascript/*.mjs`, `npm run build:audio` e `mise exec -- bin/rails zeitwerk:check`; registrar resultados reais. Falha preexistente deve ser distinguida de regressão, não escondida.
- [ ] Executar matriz da especificação: recuperar fixture, mover/redimensionar/remover/desfazer, trocar camada, ouvir ambas, seek/pausa, salvar/reabrir, duas abas e frame atrasado. Repetir com tríade vazia e notas adicionais depois do último bloco.
- [ ] Verificar em desktop/celular, dois temas, zoom e toque; conferir biblioteca/autenticação com navegação original e cabeçalhos de áudio preservados.
- [ ] Atualizar documentação com contrato novo, quatro decisões e evidência do SDK. Registrar limitações reais e separar escuta técnica da avaliação humana dos timbres.
- [ ] Revisar diff por responsabilidade e `git diff --check`; incluir arquivos novos explicitamente na revisão, pois não aparecem no diff comum. Não incluir mudanças anteriores em eventual commit da etapa.
- [ ] Registrar no DevReport os fluxos efetivamente entregues, com título, descrição, alterações, data, tags e rota existente. Não registrar somente objetos internos ou itens ainda pendentes.
- [ ] Apresentar resultado, testes e limitações ao autor antes de considerar possível avançar.

## Cobertura e execução

Contrato e compatibilidade: tarefas 1–2. Recuperação/teoria: 3. Associação,
operações e histórico: 4–5. Relógio, estados e concorrência: 6. Coordenadas,
acessibilidade, layout e views: 7. Regressão, documentação e DevReport: 8.

Recomendação: execução direta nesta tarefa, em ordem, por compartilhar contrato,
rascunho e transporte. A revisão deste plano e escolha de execução precedem
alterações na aplicação. A alternativa é execução por subagentes, com contexto
separado e revisão por tarefa, consumindo mais recursos de coordenação.
