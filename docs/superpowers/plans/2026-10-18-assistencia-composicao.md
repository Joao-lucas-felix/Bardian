# Assistência à composição — plano de implementação

> Para execução neste workspace: implementar cada tarefa com teste que falha antes do código e verificação ao final.

**Objetivo:** Entregar contexto opcional, campo harmônico e sugestões explícitas no editor de composições.

**Arquitetura:** Ruby concentra teoria e análise; a composição guarda apenas o contexto; um endpoint de leitura analisa o documento atual; Stimulus apresenta resultados e aplica notas apenas após clique.

**Tecnologias:** Rails, Ruby, Stimulus, JavaScript, CSS, JSON versão 1.

**Especificação:** `docs/superpowers/specs/2026-10-18-assistencia-composicao-design.md`.

## Restrições globais

- Preservar alterações já presentes no worktree.
- Não adicionar dependências ou migrações.
- Documentar código novo em português.
- Manter autorização por proprietário e bloqueio otimista no salvamento.

## Foco de revisão

- Documento antigo sem `context` deve continuar serializando sem contexto.
- Modo menor natural deve mostrar `v` menor e `ii°` diminuto.
- Seleção de bateria não deve receber análise tonal.
- Resposta atrasada de análise não deve sobrescrever a seleção recente.
- Aplicar acorde não deve duplicar notas idênticas no mesmo início.

## Tarefa 1: Contexto e campo harmônico

Arquivos: `app/models/music/composition.rb`, novos modelos de contexto/campo e testes em `test/models/music/`.

- [x] Escrever testes de round-trip opcional, chaves inválidas, escala e tríades nos dois modos.
- [x] Verificar falha dos testes.
- [x] Implementar contexto e campo a partir do domínio musical existente.
- [x] Verificar testes verdes.

## Tarefa 2: Análise e sugestões

Arquivos: novos objetos em `app/models/music/`, teste de domínio, `config/routes.rb`, `app/controllers/compositions_controller.rb`, testes de controller.

- [x] Escrever testes para seleção real, fora da escala, ausência de contexto, bateria e autorização.
- [x] Verificar falha dos testes.
- [x] Implementar análise determinística e rota de leitura com documento atual validado.
- [x] Verificar testes verdes.

## Tarefa 3: Aplicação explícita e painel

Arquivos: módulo em `app/javascript/composition/`, controller Stimulus, partials ERB, CSS e testes JavaScript/controller.

- [x] Escrever testes para adição explícita, preservação, deduplicação, histórico e estados da interface.
- [x] Verificar falha dos testes.
- [x] Implementar controles e painel responsivo nos dois temas.
- [x] Verificar testes verdes e renderização.

## Tarefa 4: Contrato e entrega

Arquivos: documentação do contrato/domínio, `config/dev_reports.yml`.

- [x] Revisar responsabilidades de views/controllers e atualizar documentação.
- [x] Rodar suítes Rails, JavaScript, checagem de diff e inspeção visual.
- [x] Registrar a entrega verificada no DevReport.
