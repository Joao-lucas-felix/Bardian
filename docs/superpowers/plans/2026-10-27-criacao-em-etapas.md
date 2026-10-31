# Criação em etapas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dividir a criação em metadados e primeiros sons, com opção de pular a configuração.

**Architecture:** O primeiro POST cria a composição vazia. A página de configuração opera sobre ela e aplica `CompositionStarter` somente quando a pessoa envia os controles. O link de pular segue para harmonia sem alterar o documento.

**Tech Stack:** Rails, ERB, Stimulus, domínio musical existente.

**Spec:** `docs/superpowers/specs/2026-10-27-criacao-em-etapas-design.md`

## Global Constraints

- Sem novas dependências ou mudança na representação musical.
- Preservar o formulário de edição e a API de criação já existente.
- Comentários e documentação em português.

## Review Focus

- Formulário novo com nome e capa deve seguir para a segunda página.
- Pular não deve aplicar valores padrão nem acordes.
- Configuração inválida não deve modificar a composição.
- Outra conta não deve acessar nem alterar a configuração.
- Revisitar a configuração não deve sobrescrever música existente.

---

### Task 1: Rotas e persistência

- [x] Escrever testes de criação, pulo, configuração, erro e acesso.
- [x] Rodar os testes e confirmar falha pelos comportamentos novos.
- [x] Implementar rotas e ações com validação de composição vazia.
- [x] Rodar os testes até passarem.

### Task 2: Páginas do fluxo

- [x] Testar a estrutura da primeira e segunda páginas.
- [x] Separar o formulário de metadados e montar a página de controles.
- [x] Verificar testes e largura da renderização disponível.

### Task 3: Encerramento

- [x] Revisar responsabilidades de controller, views e partials.
- [x] Rodar a suíte afetada e verificar diff.
- [x] Registrar entrega em `config/dev_reports.yml`.
