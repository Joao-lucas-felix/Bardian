# Piano Roll com WebMusic Score — Plano de Implementação

> **Para agentes:** usar TDD e executar as tarefas em ordem, verificando cada incremento antes de avançar.

**Objetivo:** criar uma rota `/componentes` com um card de piano roll em memória, baseado no modelo `@webmusic/score`, com grade de semínimas, criação de notas, seleção, exclusão e ajuste de duração.

**Arquitetura:** o Rails entrega a rota e o card ERB. Um controller Stimulus mantém a interação da superfície e uma representação `Score` inicial; a apresentação visual permanece no componente, sem persistência. O áudio continuará sendo disparado no navegador e a integração será encapsulada para não acoplar a view diretamente ao pacote.

**Tecnologias:** Rails 8, ERB, Stimulus, importmap, `@webmusic/kernel`, `@webmusic/score`, `@webmusic/ui` quando necessário e Tone.js existente.

**Especificação:** design aprovado na conversa de 2026-10-14; escopo limitado à demonstração front-end do piano roll.

## Restrições globais

- Não criar persistência de composição nesta etapa.
- Não alterar o piano interativo existente da apresentação.
- A grade inicial usa semínimas.
- Todo código novo deve conter documentação em português.
- A view deve conter apenas estrutura e apresentação; regras de estado ficam no controller.
- Registrar a entrega em `config/dev_reports.yml` antes de encerrar.

## Foco de revisão

- Dependências ESM e compatibilidade com o importmap atual: teste de carregamento da rota e auditoria do importmap.
- Score inicial sem notas: teste da estrutura básica do card e estado vazio.
- Criação de nota em uma célula: teste de evento e atualização da representação.
- Duração mínima e redimensionamento: teste de limite para não aceitar duração menor que uma semínima.
- Teclado e responsividade: revisão manual da marcação acessível e teste da rota em viewport estreita quando possível.

### Tarefa 1: Dependências e rota pública

**Arquivos:**
- Modificar: `config/importmap.rb`
- Modificar: `config/routes.rb`
- Modificar: `app/controllers/pages_controller.rb`
- Testar: `test/controllers/pages_controller_test.rb`

**Interfaces:**
- Produz: rota nomeada `components_path` apontando para `pages#components` e pins para os pacotes WebMusic necessários.

- [ ] Escrever teste que solicita `components_path` e verifica resposta 200, card do piano roll e os atributos do controller.
- [ ] Executar o teste e observar a falha porque a rota/view ainda não existe.
- [ ] Adicionar os pins e a ação do controller com documentação em português.
- [ ] Criar a view mínima do card para satisfazer a estrutura testada.
- [ ] Executar o teste de controller e verificar aprovação.

### Tarefa 2: Modelo inicial e grade visual

**Arquivos:**
- Criar: `app/views/pages/_piano_roll.html.erb`
- Criar: `app/javascript/controllers/piano_roll_controller.js`
- Modificar: `app/views/pages/components.html.erb`
- Modificar: `app/assets/stylesheets/presentation.css`
- Testar: `test/controllers/pages_controller_test.rb`

**Interfaces:**
- O controller expõe o estado de notas em memória com `notes`, onde cada nota possui `id`, `pitch`, `start` e `duration` em semínimas.
- A superfície usa `data-piano-roll-target="grid"` e células com `data-start`/`data-pitch`.

- [ ] Escrever teste de marcação para linhas de altura, células temporais e estado vazio.
- [ ] Executar o teste e observar a falha na ausência da grade.
- [ ] Implementar a grade com faixa de alturas limitada à demonstração e quatro tempos visíveis.
- [ ] Implementar o estado inicial em memória e a renderização das notas sem persistência.
- [ ] Adicionar estilos do card, grade, cabeçalho e comportamento responsivo.
- [ ] Executar os testes de controller e verificar aprovação.

### Tarefa 3: Criação, seleção e exclusão de notas

**Arquivos:**
- Modificar: `app/javascript/controllers/piano_roll_controller.js`
- Modificar: `app/views/pages/_piano_roll.html.erb`
- Testar: `test/controllers/pages_controller_test.rb`

- [ ] Escrever testes de atributos de interação e estado inicial do controller.
- [ ] Executar os testes e observar a falha nos comportamentos novos.
- [ ] Implementar clique em célula para criar nota de uma semínima, seleção visual e remoção por Delete/Backspace.
- [ ] Adicionar mensagens de status acessíveis para criação, seleção e exclusão.
- [ ] Executar testes e verificar aprovação.

### Tarefa 4: Alteração de duração e reprodução

**Arquivos:**
- Modificar: `app/javascript/controllers/piano_roll_controller.js`
- Modificar: `app/views/pages/_piano_roll.html.erb`
- Modificar: `app/assets/stylesheets/presentation.css`
- Testar: `test/controllers/pages_controller_test.rb`
- Modificar: `config/dev_reports.yml`

- [ ] Escrever teste de marcação para a alça de duração, controles de reprodução e status.
- [ ] Executar o teste e observar a falha.
- [ ] Implementar redimensionamento por semínimas, com duração mínima de uma semínima.
- [ ] Integrar reprodução de notas usando a API do pacote escolhida após a validação da importação; manter fallback explícito se a integração Tone/WebMusic não puder ser carregada.
- [ ] Implementar limpeza de listeners e recursos no disconnect.
- [ ] Executar a suíte Rails, a auditoria do importmap e a verificação JavaScript disponível.
- [ ] Registrar a entrega verificável no DevReport.
