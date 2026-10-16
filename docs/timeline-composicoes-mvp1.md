# Timeline de composições do MVP 1

Data: 16 de outubro de 2026. Etapa: edição e reprodução contínua da composição.

## Responsabilidades

`show.html.erb` contém o formulário de metadados e compõe `_timeline.html.erb`
e `_region_editor.html.erb`. Os partials cuidam apenas da apresentação e não
consultam o banco nem aplicam regras musicais. O Stimulus carrega o documento
JSON da composição autenticada e edita a mesma árvore usada pelo formulário.

`timeline_state.js` contém operações puras sobre faixas e regiões. O estado
persistido usa ticks musicais; largura e zoom existem apenas na visualização.
Uma semínima possui 480 ticks; o snap é de uma batida conforme o denominador
do compasso. O redimensionamento respeita a última nota relativa à região.
`region_notes.js` converte as notas MIDI locais de uma região para o editor e
de volta, valida seus limites e evita colisões de IDs em toda a composição.
`note_history.js` mantém snapshots imutáveis, separados por região e somente
durante a sessão.
`playback_events.js` extrai eventos absolutos e o intervalo de loop sem depender
da interface. `composition_transport.js` coordena relógio, ciclos e atualização
ao vivo; `composition_audio.js` mantém instrumento e ganho por faixa sobre o
Tone.js local. A timeline apenas envia o documento atual e apresenta o estado.

## Fluxo de uso

O usuário pode criar faixas, escolher entre os três instrumentos já presentes
no protótipo, ajustar volume, silenciar ou colocar em solo, reordenar e excluir.
Pode adicionar regiões de um compasso, criá-las por clique duplo na lane,
selecioná-las, arrastá-las, redimensioná-las pela borda direita e excluí-las.
Setas movem a região; Shift + setas altera a duração; Delete a exclui após
confirmação. O zoom não muda o documento musical.

Ao selecionar uma região, o piano roll compartilhado aparece abaixo da
timeline e mostra suas notas relativas ao início da região. É possível criar,
mover, redimensionar, excluir e alterar duração ou velocity; os botões e
atalhos Ctrl/Cmd+Z e Ctrl/Cmd+Shift+Z desfazem e refazem operações de notas
da região ativa. A reprodução é individual com o instrumento da faixa. A
grade respeita a duração exata e o compasso (inclusive 6/8 e último compasso
parcial), sem alterar ticks ao trocar BPM ou compasso. Notas MIDI de 0 a 127
são preservadas; a viewport abre perto da primeira nota ou do Dó4. A prévia
individual usa o BPM da composição; mudar o andamento interrompe uma prévia
em curso para evitar velocidade inconsistente. Uma região com notas inválidas
é bloqueada para edição e informa o erro sem truncar o documento.

Nome, andamento, compasso, faixas e regiões são salvos juntos por `PATCH` JSON
com `lock_version`. HTTP 409 não descarta o estado local: a interface mostra o
conflito e exige recuperação manual antes de recarregar. HTTP 422 mantém as
alterações para correção. Uma resposta tardia não substitui edições feitas
durante o envio. Sem JavaScript, o formulário HTML ainda salva metadados.

## Reprodução e loop

Os botões da timeline tocam, pausam/retomam e param a composição inteira.
"Ouvir faixa" isola uma faixa sem alterar solo/mute salvos. Volume, mute,
solo, instrumento, notas, regiões e BPM são enviados ao transporte ao editar,
sem exigir salvamento nem reiniciar a agulha. Notas alteradas à frente da
agulha entram na passagem atual; alterações atrás dela entram na próxima.
Notas já iniciadas não são cortadas. Uma prévia individual do piano roll pausa
a reprodução global, e o Play global interrompe a prévia individual.

O loop começa ligado. Os marcadores aceitam números em ticks, arraste na régua
e setas do teclado; são arredondados à batida. O intervalo explícito é salvo
como `loop: { start_tick, end_tick }` no mesmo JSON versionado, enquanto
documentos antigos continuam sem esse campo até uma edição de marcador.
Alterações do intervalo durante a reprodução valem na próxima volta, sem
teletransportar a agulha. Desligar o loop conclui o arranjo uma vez.

## Limites e verificação

As notas existentes permanecem nas regiões ao movê-las ou redimensioná-las.
O controle global usa as três fontes sonoras locais existentes; não há mixer,
efeitos nem exportação de áudio nesta etapa. Uma faixa cujo instrumento falhe
é informada no status, enquanto as demais podem continuar.
Regiões podem se sobrepor, pois o domínio atual não proíbe sobreposição. Não
há mesclagem automática após conflito, nem histórico persistido entre sessões.
O rascunho `/criar` e o início do Caminho do Bardo continuam independentes.

Os testes JavaScript cobrem operações de ticks, preservação de notas,
metadados e conflitos. Os testes Rails verificam contrato JSON, validação,
bloqueio por versão, reabertura de notas e renderização. A verificação manual
em servidor de teste confirmou criação por teclado e arraste, velocity,
duração, desfazer/refazer, troca de região, zoom, tema e recarga após salvar.
O movimento por arraste também foi repetido com coordenadas calibradas do
Canvas: F4 passou de tick 0 a 480 e reapareceu nessa posição após salvar e
reabrir. A tentativa anterior usou coordenadas de uma captura redimensionada,
fora da nota, e não indicava falha no gesto.
A view somente apresenta dados; validação e autorização permanecem no domínio
e no controller Rails.

Em 16/10/2026, a verificação automatizada passou com 143 testes Rails e 1043
asserções, 12 arquivos de testes JavaScript, RuboCop sem ofensas e
`zeitwerk:check` sem erros. O aceite de integração salvou e reabriu duas faixas
e loop de 480 a 2400 ticks, verificou controles HTML, bloqueio de visitante e
respostas de `/criar` e `/caminho-do-bardo/notas`. O navegador local confirmou
essas duas rotas públicas; a timeline autenticada redirecionou ao login.
Não houve conta de teste autenticada disponível no navegador, portanto a
escuta real multifaixa, o gesto visual de arraste dos marcadores, tema/foco em
dispositivos estreitos e falhas reais de amostra ainda requerem conferência
manual em sessão autenticada. Os testes de unidade cobrem as regras de
agendamento, cancelamento, passagem atual/próxima e falha de carregamento;
eles não substituem a confirmação auditiva em um navegador.
