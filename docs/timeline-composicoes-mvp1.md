# Timeline de composições do MVP 1

Data: 15 de outubro de 2026. Etapa: edição de faixas e regiões.

## Responsabilidades

`show.html.erb` contém o formulário de metadados e compõe `_timeline.html.erb`.
O partial recebe somente contagens calculadas pelo controller; não consulta o
banco nem aplica regras musicais. O Stimulus carrega o documento JSON da
composição autenticada e edita a mesma árvore usada pelo formulário.

`timeline_state.js` contém operações puras sobre faixas e regiões. O estado
persistido usa ticks musicais; largura e zoom existem apenas na visualização.
Uma semínima possui 480 ticks; o snap é de uma batida conforme o denominador
do compasso. O redimensionamento respeita a última nota relativa à região.

## Fluxo de uso

O usuário pode criar faixas, escolher entre os três instrumentos já presentes
no protótipo, ajustar volume, silenciar ou colocar em solo, reordenar e excluir.
Pode adicionar regiões de um compasso, criá-las por clique duplo na lane,
selecioná-las, arrastá-las, redimensioná-las pela borda direita e excluí-las.
Setas movem a região; Shift + setas altera a duração; Delete a exclui após
confirmação. O zoom não muda o documento musical.

Nome, andamento, compasso, faixas e regiões são salvos juntos por `PATCH` JSON
com `lock_version`. HTTP 409 não descarta o estado local: a interface mostra o
conflito e exige recuperação manual antes de recarregar. HTTP 422 mantém as
alterações para correção. Uma resposta tardia não substitui edições feitas
durante o envio. Sem JavaScript, o formulário HTML ainda salva metadados.

## Limites e verificação

As notas existentes permanecem nas regiões ao movê-las ou redimensioná-las.
Criar ou editar notas na composição persistida será responsabilidade do piano
roll na próxima etapa. A timeline ainda não reproduz múltiplas faixas nem
realiza mistura sonora. Regiões podem se sobrepor, pois o domínio atual não
proíbe sobreposição. Não há recuperação automática após conflito.

Os testes JavaScript cobrem operações de ticks, preservação de notas,
metadados e conflitos. Os testes Rails verificam contrato JSON, validação,
bloqueio por versão e renderização. A view somente apresenta dados; validação
e autorização permanecem no domínio e no controller Rails.
