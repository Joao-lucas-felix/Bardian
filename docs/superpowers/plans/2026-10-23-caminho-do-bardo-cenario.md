# Caminho do Bardo — cenário de aventura

## Direção e escopo autorizado

Aplicar na aba real a trilha vertical discutida com o usuário. A referência
enviada em 23/10 substitui os dioramas isolados por um cenário contínuo de
aventura visto de cima: caminho de terra, tavernas, vegetação e viajantes.
Manter a interface de leitura legível e a exploração livre.

## Decisões de implementação

- Rails/ERB, SVG local com geometria pixelada e CSS responsivo. Sem biblioteca,
  motor de jogo, imagem externa, animação contínua ou alteração de persistência.
- `index` organiza cabeçalho, progresso e trilha. `_trail_stop` apresenta uma
  aula e seu estado. `_scenery` apresenta somente a imagem decorativa.
- Controller calcula totais e próxima aula ainda não concluída com os dados
  já carregados. Nenhuma consulta nas views.
- Cada aula publicada aparece como parada por enquanto. O agrupamento editorial
  em tavernas temáticas será definido junto da preparação das aulas; não inferir
  temas pela posição nem publicar conteúdo de demonstração.
- Catálogo vazio exibe cenário e aviso de preparação sem links fictícios,
  progresso inventado ou aulas bloqueadas.
- A imagem de referência orienta a direção; não será incorporada como asset.

## Execução e verificação

- [x] Testar a renderização vazia, progresso real e links livres antes da mudança.
- [x] Implementar cenário, partials, estilo local e totais no controller.
- [x] Executar testes Rails afetados e renderização ERB.
- [ ] Verificar visualmente desktop/mobile: Chromium ausente e Firefox/Snap bloqueado pelo sistema de arquivos restrito.
- [x] Revisar responsabilidades e registrar entrega/limitações no DevReport.

Verificação: 16 testes focados (86 asserções), suíte Rails com 177 testes
(1162 asserções), todos sem falhas; Zeitwerk e whitespace aprovados.
As views não consultam dados, autorizam acesso ou calculam progresso.

## Fora desta etapa

Currículo definitivo, organização editorial em tavernas, novas aulas, minijogos,
recompensas persistentes e novas funções de áudio.
