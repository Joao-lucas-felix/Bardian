# Início da composição Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar composições com contexto e prévia harmônica opcional e conduzir a pessoa da harmonia à escolha da próxima parte musical.

**Architecture:** `CompositionStarter` concentra a montagem e validação do documento musical. `CompositionsController` fornece a prévia e salva a seleção; um controlador Stimulus coordena controles e escuta usando o transporte atual. A nova tela de próximos passos é apresentação autorizada da composição.

**Tech Stack:** Rails, ERB, Stimulus, motor de harmonia openDAW já presente.

**Spec:** `docs/superpowers/specs/2026-10-25-inicio-composicao-design.md`

## Global Constraints

- Sem dependências ou geradores musicais novos.
- Comentários e documentação de código em português.
- Preservar os arquivos locais e as responsabilidades das views.

## Review Focus

- Troca rápida de tônica ou modo: resposta antiga não deve sobrescrever a nova.
- Escolha submetida após troca de contexto: rejeitar sequência inválida.
- Áudio indisponível: prévia textual e criação devem continuar utilizáveis.
- Acesso à próxima tela por outra conta: responder como composição ausente.
- Saída da harmonia com alterações pendentes: preservar aviso existente.

---

### Task 1: Documento inicial e prévias

**Files:** criar `app/models/composition_starter.rb`; alterar `app/controllers/compositions_controller.rb`, `config/routes.rb`; testar `test/models/composition_starter_test.rb` e `test/controllers/compositions_controller_test.rb`.

**Interfaces:** `CompositionStarter.new(id:, name:, bpm:, tonic:, mode:, instrument:)`, `#preview(count: 3)` e `#document(degrees: nil)`.

- [x] Escrever testes de propostas, persistência e rejeição de entradas inválidas.
- [x] Executar e confirmar falha por ausência do recurso.
- [x] Implementar o serviço e a rota de prévia, reutilizando `Music::HarmonyGenerator`.
- [x] Executar os testes e confirmar resultado verde.

### Task 2: Formulário e escuta

**Files:** alterar `app/views/compositions/new.html.erb`, `app/views/compositions/_metadata_form.html.erb`, `app/assets/stylesheets/music_workspace.css`; criar `app/views/compositions/_starter_controls.html.erb`, `app/javascript/controllers/composition_starter_controller.js`; testar `test/controllers/compositions_controller_test.rb` e JavaScript aplicável.

**Interfaces:** POST de prévia recebe BPM, tônica, modo e instrumento; devolve três listas de opções do domínio. O formulário envia apenas os graus da opção escolhida.

- [x] Testar renderização da seção e contrato JSON; confirmar falha.
- [x] Implementar controles, apresentação das propostas, invalidação e escuta.
- [x] Confirmar testes e inspeção funcional.

### Task 3: Próximo passo

**Files:** alterar `app/views/harmony/show.html.erb`, `app/controllers/compositions_controller.rb`, `config/routes.rb`; criar `app/views/compositions/next_step.html.erb`; testar `test/controllers/compositions_controller_test.rb`.

**Interfaces:** GET `/compositions/:id/next_step` para o dono; link “Próximo passo” na harmonia.

- [x] Testar navegação e autorização; confirmar falha.
- [x] Implementar a tela e links correspondentes.
- [x] Confirmar testes de controller e renderização.

### Task 4: Revisão da entrega

**Files:** alterar `config/dev_reports.yml` e documentação relevante.

- [x] Executar testes afetados, suíte e inspeção visual limitada.
- [x] Revisar responsabilidades de ERB, corrigir apenas dentro do escopo.
- [x] Registrar entrega verificável no DevReport.
