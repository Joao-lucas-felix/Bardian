# Base open source de DAW para o Bardian — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar e, se compatível, integrar uma base open source de áudio para reduzir a implementação de infraestrutura genérica de DAW e priorizar composição assistida e aprendizagem.

**Architecture:** O JSON musical Rails continua sendo a fonte persistida. Um adaptador JavaScript traduz a composição para uma sessão de execução openDAW sem levar regras harmônicas ao SDK nem expô-lo aos controllers Stimulus. A adoção é condicionada a uma prova funcional com assets servidos localmente, isolamento cross-origin e critérios de qualidade; reprovação encerra a migração e documenta o resultado sem trocar silenciosamente de arquitetura.

**Tech Stack:** Rails 8.1, JavaScript, Importmap atual, testes Rails/Node existentes; candidato `@opendaw/studio-sdk` com artefatos WASM/AudioWorklet/worker locais. Um pipeline de build adicional só será incorporado se a prova confirmar sua necessidade e custo aceitável.

**Spec:** `docs/superpowers/specs/2026-10-18-base-daw-open-source-design.md`

## Global Constraints

- Preservar o contrato JSON musical atual durante a primeira integração.
- Manter regras musicais e harmônicas no domínio Bardian, fora do SDK de áudio.
- Fixar a versão exata do SDK e registrar licenças de código, dependências, instrumentos e samples.
- Servir os módulos, WASM, worklet, workers e sons necessários a partir do Bardian; verificar COOP/COEP e `crossOriginIsolated`.
- Nenhuma adoção de produção sem reproduzir composição real com andamento, durações, faixas e loop.
- A interface deve preservar a escolha do usuário: sugestões explicam e podem ser aplicadas ou rejeitadas.
- Produção sonora é subordinada ao núcleo de composição assistida e aprendizagem; não criar DAW profissional.
- Documentar código novo em português e registrar a entrega verificada em `config/dev_reports.yml`.

## Review Focus

- Composição antiga sem campos opcionais — provar compatibilidade no teste do adaptador e na reprodução de regressão.
- Documento malformado, notas no limite MIDI e duração zero — provar que validação impede corrupção ou erro de áudio no parser/adaptador.
- Navegador sem isolamento cross-origin ou com WASM indisponível — provar fallback ou erro acessível e documentado na prova técnica.
- Mudança de faixa/instrumento durante reprodução, pausa e descarte — provar ciclo de vida, cancelamento e ausência de áudio duplicado nos testes do adaptador.
- Assets de instrumento ausentes ou sem licença comprovada — provar falha isolada, atribuição visível/documentada e ausência de dependência de URL externa.

---

## Mapa de arquivos e responsabilidades

- `app/javascript/audio/composition_audio.js`: borda atual de playback; será substituída ou delegada ao adaptador somente após a prova.
- `app/javascript/audio/composition_transport.js` e `app/javascript/composition/playback_events.js`: manter o transporte/eventos enquanto a prova não demonstrar que o SDK os substitui sem perda; evitar duplicar dois relógios em produção.
- `app/javascript/audio/phrase_instruments.js`: catálogo e carregamento atual; migrar apenas as fontes necessárias e manter IDs existentes ou um mapeamento explícito.
- `app/javascript/audio/opendaw_composition_engine.js` (condicional): única fronteira com SDK; controla inicialização, sessão, transporte, fontes, efeitos e descarte, conforme API pública confirmada na prova.
- `app/javascript/controllers/composition_timeline_controller.js`: continua coordenando a interface e chama a borda sonora; não importa tipos ou objetos openDAW.
- `config/importmap.rb`, `package.json`/lockfile e configuração de build (condicionais): integração do SDK; adotar bundler apenas se necessário à carga de módulos, WASM, worklet e worker.
- `config/initializers/` (condicional): política COOP/COEP para a página de composição; limitar escopo e testar efeitos em recursos cross-origin.
- `app/views/compositions/_timeline.html.erb` e `app/views/compositions/_region_editor.html.erb`: controles de produção simples, extraídos em partials apenas quando tiverem responsabilidade própria; apresentação sem consulta ou regra de domínio.
- `app/assets/stylesheets/productivity.css` (ou folha específica de áudio): estados de controles, acessibilidade, responsividade e temas.
- `test/javascript/`: testes de conversão, lifecycle e áudio simulado; `test/controllers/`/`test/models/`: regressões Rails relevantes.
- `docs/referencias-daw.md` e `docs/licencas-audio.md`: comparação de recursos, fluxo, custo operacional, licença e atribuição de SDK e assets.
- `config/dev_reports.yml`: registro da entrega somente após validação da etapa.

## Etapa 1 — Prova local e decisão de adoção

**Resultado:** aplicação mínima reproduz uma composição real existente servindo o SDK e seus assets pelo próprio Rails; relatório registra continuar/parar.

**Arquivos:** prova isolada em `tmp/opendaw-compatibility-spike/` (não incorporada ao runtime); dados de fixture sob `test/fixtures/files/` somente se reutilizáveis; relatório em `docs/referencias-daw.md` e decisão em `docs/superpowers/specs/2026-10-18-base-daw-open-source-design.md`.

**Interfaces:** entrada é documento JSON validado com duas faixas, notas de durações diferentes, BPM, volume/mute/solo e loop; saída é playback observável com eventos equivalentes e log dos recursos efetivamente usados. A prova registra assinaturas públicas do SDK utilizadas, sem inventar contrato de produção.

- [x] Fixar a versão publicada examinada, registrar metadados/licenças e instalar o SDK em ambiente isolado, sem tocar no Importmap nem nos arquivos de áudio atuais.
- [x] Executar build mínima e servir localmente JS, WASM, AudioWorklet, worker e fonte WASM; requests observados foram ao mesmo host. A demo tentou buscar apenas um logo local inexistente (404); fontes Google e analytics foram removidos da cópia de prova.
- [x] Provar `crossOriginIsolated` e resposta WASM; COOP/COEP ficaram restritos a `/opendaw-proof/*` e a home permaneceu sem esses cabeçalhos. O impacto em todas as páginas/recursos cross-origin ainda não foi avaliado.
- [ ] Mapear campos atuais (ticks/MIDI, BPM, regiões, faixa, ganho, mute/solo, loop) para APIs públicas confirmadas e comparar a timeline/áudio observados com a composição-fonte.
- [ ] Registrar qualidade percebida, latência inicial, custo de build/implantação, superfície de API, licença e tabela “SDK reutilizado / Bardian mantido”.
- [ ] Aplicar o gate: continuar apenas se todos os critérios de compatibilidade do spec forem satisfeitos e a integração não exigir migração desproporcional; caso contrário, documentar interrupção e encerrar sem alterar playback de produção.

**Verificação:** prova reproduzível em navegador local; versão e comandos registrados; `crossOriginIsolated === true` na configuração WASM; nenhum asset de runtime remoto; notas, BPM, faixas e loop conferidos. Esta etapa não adiciona dependência ao bundle publicado do Bardian.

**Nota de progresso:** a conversão da fixture sintética do contrato Rails foi comparada por leitura de volta no modelo openDAW e passou 20/20 verificações, com sinal de saída e wrap do loop observados. A consulta somente leitura do banco encontrou 2 composições, ambas com uma faixa e sem loop; por isso, esse resultado não satisfaz o critério de composição persistida e os itens de mapeamento, qualidade/performance e gate permanecem pendentes.

## Etapa 2 — Adaptador e migração incremental (condicional à aprovação da Etapa 1)

**Resultado:** playback da composição passa por uma API pequena e estável do Bardian, mantendo o documento persistido e a interface independentes do SDK.

**Interfaces:** definir após a prova, com contrato mínimo `createCompositionAudio(options)`, `start()`, `play(composition)`, `pause()`, `stop()`, `setTrackVolume(trackId, value)`, `dispose()`. A implementação traduz JSON para sessão SDK e converte eventos de estado para o formato já consumido pelo controller. Se API pública não suportar um membro, registrar a diferença e ajustar contrato antes de migrar.

- [ ] Escrever testes de contrato para conversão de ticks/durações/velocity, mapeamento de instrumentos, faixas e opções opcionais antes de trocar o runtime.
- [ ] Integrar apenas o pipeline de build mínimo comprovado; fixar SDK e lockfile, servir seus artefatos sob Rails e configurar isolamento apenas na página/escopo necessário.
- [ ] Implementar a fronteira sonora em `app/javascript/audio/opendaw_composition_engine.js`, encapsulando inicialização, carregamento, tratamento de erro e descarte.
- [ ] Atualizar `composition_audio.js` para delegar à fronteira nova sem alterar a API usada pelo transporte/controller; não manter simultaneamente dois relógios de playback.
- [ ] Migrar uma composição real e comparar regressões de play/pause/stop, loop, edição ao vivo, isolamento de faixa, mute/solo, troca de instrumento e saída da página.
- [ ] Remover Tone.js e os pinos Importmap apenas quando nenhuma outra funcionalidade ainda depender deles; a retirada é verificável por busca de imports e execução da suíte.

**Verificação:** `node --test test/javascript/composition_audio_test.mjs test/javascript/composition_transport_test.mjs test/javascript/playback_events_test.mjs`, testes de integração adicionados e suíte Rails relevante. Manualmente, ouvir a mesma composição no novo engine e verificar ausência de notas duplicadas, cliques ou deriva observável.

## Etapa 3 — Timbres, envelope e primeiro efeito

**Resultado:** instrumentos têm fontes licenciadas e coerentes; pessoa pode ajustar attack por instrumento/faixa (se suportado) e comparar áudio sem/com reverb.

**Arquivos:** catálogo em `app/javascript/audio/phrase_instruments.js` ou módulo novo de catálogo; adaptador da Etapa 2; controls em partial dedicado da composição; `docs/licencas-audio.md`; testes JavaScript existentes de instrumentos e novos testes de parâmetros.

**Interfaces:** IDs persistidos de instrumentos permanecem estáveis; perfis sonoros e parâmetros aceitam valores validados e delimitados. Reverb começa desligado e tem controle acessível para liga/desliga e intensidade somente se o SDK expuser parâmetro público estável. Attack é controlado por preset ou parâmetro de instrumento, não modifica notas MIDI.

- [ ] Inventariar fontes atuais e candidatas com licença, origem, atribuição, tamanho e faixa de notas; excluir fonte sem licença verificável.
- [ ] Selecionar um conjunto mínimo de timbres para a composição demonstrativa e adicionar teste de carregamento/erro e rota local de assets.
- [ ] Adicionar teste de fronteira do attack (mínimo, típico, máximo e valor inválido); implementar normalização no adaptador e manter perfil padrão quando o documento antigo omite parâmetro.
- [ ] Adicionar teste do estado inicial do reverb desligado e de alternância; implementar envio de parâmetro ao processador SDK sem criar cadeia de efeito paralela fora do adaptador.
- [ ] Comparar áudio seco/molhado e attack curto/longo em escuta manual documentada, anotando limitações perceptivas e navegador/dispositivo.

**Verificação:** testes dos instrumentos e adaptador; inspeção de network para assets locais; teste auditivo manual cobrindo notas curtas/sustentadas, acordes e cauda do reverb. Sem mixer completo, automação ou novos efeitos nesta etapa.

## Etapa 4 — Fluxo de criação assistida e organização

**Resultado:** editor comunica claramente o fluxo compor → entender → escolher sugestão → ouvir, sem transformar o Bardian em DAW genérica.

**Arquivos:** `app/views/compositions/show.html.erb`, partials de timeline, region editor e assistência; controller Stimulus de timeline; CSS da experiência de composição e navegação. Manter consultas e regras no controller/modelo/objetos de domínio.

**Interfaces:** assistência fornece explicação e ação explícita de aplicar/rejeitar; alteração aplicada atualiza a mesma representação da composição e o áudio. Controles de produção usam linguagem simples e não expõem conceitos internos do SDK.

- [ ] Rever fluxo e hierarquia da página usando a composição real da prova; documentar responsabilidades da view e de cada partial e dados recebidos.
- [ ] Ajustar a proximidade entre explicação harmônica, sugestão aplicável e escuta do resultado sem remover timeline/piano roll existentes.
- [ ] Colocar attack e reverb junto aos controles da faixa/instrumento, com rótulos acessíveis, estados e ajuda curta; evitar painel profissional de mixer.
- [ ] Testar sugestão aplicada versus rejeitada, playback resultante, tema claro/escuro, viewport estreito, foco de teclado e controles sem áudio pronto.
- [ ] Revisar ERBs quanto a consultas, autorização e lógica; extrair responsabilidades indevidas apenas dentro deste escopo.

**Verificação:** testes de controller/JavaScript afetados, renderização Rails e verificação manual de página autenticada nos temas e tamanhos relevantes.

## Etapa 5 — Documentação, licenças e entrega

**Resultado:** decisões, arquitetura, limites e reprodução da verificação ficam rastreáveis para implementação e TCC.

- [ ] Completar `docs/referencias-daw.md` com matriz de referências, implementação aproveitada, implementação Bardian, fonte primária, licença e decisão de adoção.
- [ ] Completar `docs/licencas-audio.md` com SDK, dependências distribuídas, assets de áudio, atribuições e procedimento de atualização de inventário; registrar ressalva de que não é parecer jurídico.
- [ ] Documentar build local/deploy, cabeçalhos, navegador testado, procedimento de escuta e limitações conhecidas.
- [ ] Executar suites JS/Rails afetadas, RuboCop, Zeitwerk e revisão de responsabilidades; corrigir regressões dentro do escopo autorizado.
- [ ] Registrar em `config/dev_reports.yml` a entrega verificada, a rota de teste e limitações; não marcar prova de conceito como adoção de produção se o gate reprovar.

## Dependências entre etapas e limites

Etapa 1 é independente e bloqueia a adoção. Se reprovar, etapas 2–4 não são executadas; encerra-se com matriz de referências, conclusão técnica e opções para decisão do autor. Etapas 2–4 dependem da API real que a prova confirmar. A integração pode exigir bundler e cabeçalhos globais, ambas mudanças arquiteturais relevantes já identificadas no spec; se o spike mostrar impacto que afete outras páginas, parar e apresentar a escolha específica antes de incorporar. Não se migra persistência para formato openDAW nesta etapa.
