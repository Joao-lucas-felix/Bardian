# Editor Piano Roll inspirado no BandLab — Plano de Implementação

> **Para agentes:** usar TDD e executar as tarefas em ordem, verificando cada incremento antes de avançar.

**Objetivo:** substituir a grade demonstrativa por um editor de piano roll navegável, com interação de DAW e modelo musical separado da camada visual.

**Arquitetura:** o controller Stimulus manterá notas temporárias em ticks musicais e usará Canvas 2D para desenhar teclado, grade, notas e playhead. A view ERB fornecerá apenas a superfície, toolbar e acessibilidade mínima; `@webmusic/score` continuará sendo reconstruído a partir do estado editável e Tone.js continuará responsável pela reprodução.

**Tecnologias:** Rails 8, ERB, Stimulus, Canvas 2D, `@webmusic/score`, Tone.js e CSS existente. Nenhuma nova dependência JavaScript nesta etapa.

**Especificação:** redesign aprovado na conversa de 2026-10-14, inspirado nos fluxos de edição MIDI do BandLab, Pianizer e Tween MIDI Editor.

## Restrições globais

- Não criar persistência, importação/exportação MIDI ou múltiplas faixas nesta etapa.
- Não alterar o piano interativo existente da apresentação.
- O estado musical não pode depender de coordenadas em pixels.
- A grade padrão usa semínimas, mas permite selecionar colcheias e semicolcheias.
- Todo código novo deve conter documentação em português.
- A view deve conter estrutura e apresentação; estado e regras ficam no controller.
- Registrar a entrega em `config/dev_reports.yml` antes de encerrar.

## Foco de revisão

- Conversão entre coordenadas musicais e pixels, principalmente com zoom e rolagem.
- Clamp de notas no limite da grade e duração mínima de um passo.
- Interação concorrente entre desenhar, mover, redimensionar e selecionar.
- Teclado acessível, foco da superfície e responsividade.
- Limpeza do Canvas, listeners e Tone.js ao sair da rota.

### Tarefa 1: Contrato da nova superfície

**Arquivos:**
- Modificar: `test/controllers/pages_controller_test.rb`
- Modificar: `app/views/pages/_piano_roll.html.erb`
- Modificar: `app/assets/stylesheets/presentation.css`

**Interfaces:**
- Produz uma superfície `[data-piano-roll-target="surface"]` com Canvas, toolbar de snap/zoom e regiões para piano roll e velocity.

- [ ] Escrever testes de marcação para Canvas, toolbar, snap e regiões auxiliares.
- [ ] Executar os testes e observar a falha na ausência da nova estrutura.
- [ ] Implementar a nova marcação sem remover o controller existente antes da transição.
- [ ] Executar os testes de controller e verificar aprovação.

### Tarefa 2: Estado musical e coordenadas

**Arquivos:**
- Modificar: `app/javascript/controllers/piano_roll_controller.js`
- Testar: `test/controllers/pages_controller_test.rb`

**Interfaces:**
- Cada nota possui `id`, `pitch`, `onset`, `duration` e `velocity`; `onset` e `duration` são expressos em ticks.
- O controller expõe `pixelsToMusic`, `musicToPixels` e `snapTick` para a camada de interação.

- [ ] Escrever testes de contrato para a resolução padrão, snap e limites de pitch/tempo.
- [ ] Executar os testes e observar a falha.
- [ ] Implementar estado, viewport, zoom e conversões musicais sem depender do tamanho atual do Canvas.
- [ ] Reconstruir o `Score` usando `Rational` e `Duration` a partir dos ticks.
- [ ] Executar testes e verificar aprovação.

### Tarefa 3: Renderização Canvas

**Arquivos:**
- Modificar: `app/javascript/controllers/piano_roll_controller.js`
- Modificar: `app/assets/stylesheets/presentation.css`

**Interfaces:**
- `render()` desenha grade, teclas, notas, seleção, cabeçalho temporal e playhead.
- `hitTest(point)` retorna a nota ou região da grade atingida.

- [ ] Escrever teste de comportamento para renderizar a superfície vazia e notas selecionadas.
- [ ] Executar o teste e observar a falha.
- [ ] Implementar o renderer Canvas 2D em camadas, mantendo o modelo independente da tela.
- [ ] Implementar rolagem e zoom com preservação do estado musical.
- [ ] Executar testes e revisar visualmente em desktop e viewport estreita.

### Tarefa 4: Ferramentas de edição

**Arquivos:**
- Modificar: `app/javascript/controllers/piano_roll_controller.js`
- Modificar: `app/views/pages/_piano_roll.html.erb`
- Testar: `test/controllers/pages_controller_test.rb`

- [ ] Escrever testes de desenho, seleção, movimento, redimensionamento, exclusão e seleção múltipla.
- [ ] Executar os testes e observar a falha.
- [ ] Implementar gesto de criação por arraste, movimento por corpo da nota, resize pelas bordas e seleção por arraste vazio.
- [ ] Implementar Delete/Backspace, Escape e atalhos básicos de zoom/snap.
- [ ] Implementar prévia sonora da altura ao clicar no teclado virtual.
- [ ] Executar testes e verificar aprovação.

### Tarefa 5: Transporte, acessibilidade e entrega

**Arquivos:**
- Modificar: `app/javascript/controllers/piano_roll_controller.js`
- Modificar: `app/views/pages/_piano_roll.html.erb`
- Modificar: `app/assets/stylesheets/presentation.css`
- Modificar: `config/dev_reports.yml`

- [ ] Escrever teste de marcação para status, transporte, labels e fallback de áudio.
- [ ] Implementar playhead sincronizado com Tone.js, play/stop e mensagens acessíveis.
- [ ] Garantir limpeza de listeners, animation frame e sintetizador no `disconnect`.
- [ ] Executar suíte Rails, auditoria do importmap, verificação JavaScript e revisão visual no navegador.
- [ ] Registrar a entrega no DevReport.
