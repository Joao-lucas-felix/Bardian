# Timeline de composições do MVP 1

Data: 16 de outubro de 2026. Etapa: edição e reprodução contínua da composição.

## Responsabilidades

`show.html.erb` compõe `_details_form.html.erb`, `_timeline.html.erb`
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
O controle global oferece oito instrumentos organizados por família: piano,
teclado elétrico, cordas, guitarra limpa, baixo elétrico, sopro, pad
sintetizado e bateria. Piano, cordas e bateria usam os samples locais já
documentados. Teclado, guitarra, baixo, sopro e pad usam síntese procedural
do Tone.js nesta etapa; esses timbres são fontes funcionais de MVP, não uma
avaliação definitiva de realismo acústico. Não há mixer, efeitos nem
exportação de áudio nesta etapa. Uma faixa cujo instrumento falhe é informada
no status, enquanto as demais podem continuar.
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

## Área de trabalho da composição salva — 17/10/2026

Somente `/compositions/:id` usa o layout de janela. O cabeçalho compacto
concentra nome, BPM, compasso, status de salvamento e ações. A timeline e o
piano roll da região selecionada dividem a altura restante; as faixas e a
grade MIDI rolam internamente, sem rolagem da página no desktop. Sem região
selecionada, a timeline ocupa a área inteira. Em janelas estreitas ou muito
baixas, a página volta a rolar para não comprimir controles e teclado; o painel
MIDI mantém altura limitada e sua grade continua rolável. A ajuda do editor
fica recolhida por padrão, mas acessível pelo teclado. `/criar`, documento
musical, persistência e transporte de áudio não mudam com esta etapa.

O ajuste de densidade mantém os controles de cada faixa em duas linhas de
aproximadamente 69 px, com nomes acessíveis para ações abreviadas. A ajuda da
timeline ficou recolhível. Em 1440 × 900, três faixas completas e o piano roll
ficam visíveis sem rolagem externa; abaixo de 820 px de altura a página pode
rolar para preservar uma grade MIDI utilizável. O Canvas da composição lê as
cores do tema ativo e redesenha ao alterná-lo; o rascunho `/criar` conserva a
paleta anterior. Essa adaptação é visual e não modifica notas ou reprodução.

## Piano roll ampliado por região — 17/10/2026

Na composição salva, selecionar uma região habilita **Ampliar editor**. A vista
maior ocupa a janela disponível, mas mantém a mesma instância do piano roll:
notas não salvas, seleção, histórico de desfazer/refazer e reprodução não são
reiniciados pela alternância. **Voltar à composição** e Esc fecham a vista;
Esc é capturado antes do atalho do Canvas para não apagar a seleção. O foco
retorna ao botão e o restante da página recupera seu estado de interação e
rolagem. A edição continua limitada à região selecionada, não à faixa inteira.

Em telas estreitas, a vista ocupa toda a janela, enquanto a grade mantém sua
própria rolagem. Não há novo formato MIDI, endpoint, dependência ou mudança em
`/criar`. O teste no navegador local confirmou desktop, telefone, temas claro
e escuro, além da preservação de uma nota pendente e sua seleção ao fechar.

## Orientação contextual e autosave — 17/10/2026

O piano roll publica a seleção atual para a composição. O painel de orientação
mostra nome da nota, pitch MIDI, início, duração e velocity; com duas ou mais
notas, informa a distância cromática entre a primeira e a última seleção. O
painel não marca o documento como alterado e não afirma tonalidade, escala,
grau ou função harmônica sem contexto declarado no contrato musical.

Após qualquer edição persistível, o controller agenda o autosave para um
segundo depois da última alteração. Um novo gesto reinicia o timer, e somente
uma requisição fica ativa por vez. O endpoint existente continua usando
`lock_version`: falhas de rede e conflitos mantêm o documento local, enquanto
alterações feitas durante uma resposta tardia são agendadas novamente. O
status informa quando há alterações pendentes, salvamento em andamento ou
sucesso; sair da página com alterações ainda pendentes aciona o aviso nativo
do navegador.

## Catálogo ampliado de instrumentos — 17/10/2026

O seletor de instrumento da timeline passou a consumir um catálogo único com
IDs estáveis, rótulos, categorias e origem sonora. As opções são agrupadas por
família na interface, mas continuam persistindo somente o `instrument_id` da
faixa; nenhum evento MIDI é alterado ao trocar o timbre.

O catálogo combina samples locais licenciados com síntese procedural. A
síntese reduz o tamanho do repositório e permite validar as famílias novas sem
introduzir uma dependência de rede ou copiar samples sem atribuição. Cada
instrumento é carregado sob demanda e liberado junto com a faixa. Os testes
verificam o contrato do catálogo, carregamento das fontes, seleção e
preservação do caminho existente de falha de áudio.

## Controle compacto de reprodução — 18/10/2026

Os controles principais da composição foram reduzidos a um único botão de
transporte. Em estado parado ou pausado ele exibe **Tocar**; durante a
reprodução exibe **Parar** e encerra o ciclo atual. O estado de carregamento
desabilita o botão e informa **Carregando…**. A pausa continua disponível
internamente para preservar a posição durante prévias e mudanças, mas não
ocupa mais um controle permanente na interface.

O loop, seus marcadores e a ação de ouvir uma faixa continuam separados por
terem efeitos diferentes. O botão usa SVG e rótulos acessíveis, preserva a
atualização da agulha e não altera o documento musical.

## Navegação lateral e polimento visual — 18/10/2026

A navegação global deixou de ocupar uma barra horizontal fixa e passou a usar
uma sidebar esquerda compacta. O item atual recebe destaque por cor e trilha
lateral, enquanto a área inferior reúne tema, conta e um medidor decorativo da
jornada musical. Esse medidor é apenas visual: não representa XP, pontos,
conquistas ou progresso persistido.

Em telas pequenas, a sidebar vira um painel lateral aberto por botão, com
fundo de proteção, fechamento por Escape e fechamento ao escolher uma rota.
Os controles mantêm nomes e foco acessíveis. Botões, cards e regiões receberam
transições curtas de hover, foco e seleção; `prefers-reduced-motion` reduz as
transições e animações para respeitar a preferência do usuário. Nenhuma dessas
alterações modifica rotas, permissões, áudio ou o documento musical.

## Paleta do piano roll — 18/10/2026

A grade MIDI da página de composições passou a usar os mesmos neutros navy,
superfícies e acento coral da interface global. O espaço vazio, as linhas da
grade, o teclado, a régua e a lane de velocity não usam mais o fundo
azul-esverdeado anterior. Notas comuns usam rosa claro para serem distinguíveis,
enquanto a nota selecionada, a agulha e o marcador inicial usam o acento da
interface; o marcador final usa o texto secundário.

As cores do Canvas são tokens CSS por tema, lidos pelo controller, portanto a
troca entre claro e escuro redesenha a mesma composição sem alterar notas,
seleção, loop ou reprodução. A mudança é exclusivamente visual e mantém a
paleta anterior do rascunho `/criar` fora da página de composições.
