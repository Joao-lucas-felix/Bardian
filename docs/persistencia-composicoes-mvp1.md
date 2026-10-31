# Persistência de composições do MVP 1

Data: 15 de outubro de 2026. Estado: CRUD Rails implementado.

## Decisão de engenharia

Cada composição pertence a um `User` e ocupa uma linha na tabela
`compositions`, com ID textual, documento JSON completo, `lock_version` e
timestamps. O ID da linha coincide com o `id` do contrato musical. O nome
permanece dentro do documento; a listagem lê esse campo, evitando duas cópias
persistidas do mesmo metadado. A aplicação usa o SQLite já configurado e não
adiciona dependências.

O modelo Active Record `Composition` valida todo o documento por meio de
`Music::Composition.from_h` antes de gravar. Isso preserva a separação entre
persistência e domínio musical. O banco garante o vínculo com o usuário; as
restrições das notas, regiões, instrumentos e IDs pertencem ao contrato Ruby.

Essa escolha favorece o salvamento atômico da árvore musical no prazo do TCC.
Tabelas próprias para faixas, regiões e notas exigiriam mais migrações e
coordenação de gravações. O documento JSON não oferece consultas SQL simples
por nota; se essas consultas virarem requisito, a estrutura deverá ser revista
com migração de dados.

## Fluxo HTTP

- `GET /compositions` lista apenas as composições do usuário autenticado.
- `POST /compositions` cria um documento vazio, com 120 BPM e compasso 4/4.
- `GET /compositions/:id` mostra metadados e contagens de faixas, regiões e
  notas. Com `Accept: application/json`, devolve `document` e `lock_version`.
- `PATCH /compositions/:id` aceita o formulário de nome, BPM e compasso ou,
  em JSON, o documento inteiro e sua `lock_version`.
- `DELETE /compositions/:id` exclui uma composição própria após confirmação
  na interface.

Todas as buscas por ID usam `current_user.compositions`. O formulário mostra
alterações pendentes até o salvamento manual. Um pedido com versão antiga
recebe HTTP 409; dados inválidos recebem HTTP 422. O controller também trata
`ActiveRecord::StaleObjectError` caso duas gravações concorram depois da
primeira conferência de versão. Não há mesclagem automática de documentos.

## Organização da interface

`index.html.erb` contém a criação e a lista; `_composition_card.html.erb`
apresenta nome e data de cada item recebido. `show.html.erb` organiza o
formulário e o resumo. Os dados vêm do controller, a validação fica no domínio
e no modelo, e as views não consultam o banco. O controller Stimulus da timeline
coordena metadados, faixas e regiões no mesmo documento. Veja
[timeline-composicoes-mvp1.md](timeline-composicoes-mvp1.md).

As rotas públicas `/criar` e `/caminho-do-bardo/notas` permanecem disponíveis.
O novo catálogo está acessível pela navegação para contas autenticadas. A
timeline altera faixas e regiões deste documento. O piano roll persistido ainda
não foi integrado.

## Verificação e limitações

Os testes de integração exercitam criação, listagem, reabertura de documento
com faixas e notas, alteração de metadados sem perda de MIDI, exclusão,
autorização entre usuários, identidade do documento, erros 422 e conflitos
409. O feedback de alterações pendentes agora é testado junto ao controller da timeline.

Esta etapa ainda não oferece edição de notas na composição, reprodução sincronizada,
catálogo ampliado de instrumentos ou recuperação de mudanças locais após um
conflito. A interface preserva o estado local e informa o erro; a recuperação
ou mesclagem após conflito ainda exige decisão do usuário.
