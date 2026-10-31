# Blocos harmônicos, notas adicionais e transporte navegável

## Status e objetivo

Especificação do próximo sprint, com as quatro decisões de comportamento da
revisão preventiva aprovadas pelo autor nesta conversa. A implementação ainda não
começou. O objetivo é registrar a identidade musical de cada acorde
independentemente das notas executadas, permitir notas adicionais sem bloquear
a composição, recuperar a timeline da música `Teste 1`, dar ao editor uma
apresentação coerente com a página atual e controlar a escuta pelo ponto
escolhido pelo usuário.

O fluxo principal continua sendo criar, ouvir, compreender e modificar. O
usuário deve enxergar sua sequência, acrescentar acordes e notas pelo piano
roll, entender qual acorde está declarado em cada trecho, ouvir as notas extras,
posicionar a agulha, pausar e retomar sem recomeçar a música. A estrutura já
deve admitir que a execução de um acorde se torne um arpejo em uma etapa futura.

Revisão preventiva: este documento descreve comportamento proposto, não recursos
implementados ou bugs já corrigidos. As quatro decisões destacadas ao final foram aprovadas pelo autor; essa
aprovação registra o desenho e não inicia a implementação. Esta revisão fecha contratos de
dados, operações destrutivas e estados assíncronos.

## Evidências e limites atuais

- `Music::HarmonyLane` aceita somente uma faixa e tríades contíguas, com três
  notas de mesmo início e duração. `Teste 1` contém C4/E4/G4 por 960 ticks e
  C3 por 480 ticks no primeiro início; por isso os 10 blocos deixam de ser
  projetados e `can_append` fica falso.
- `CompositionHarmony` projeta apenas a faixa `harmony-<id>` e preserva as
  demais faixas ao salvar. O contrato JSON versão 1 já suporta múltiplas
  faixas, mas `Music::Composition#to_h` só serializa os campos conhecidos;
  metadados harmônicos novos precisam entrar nesse contrato explicitamente.
- `Chord` e `ChordPattern` já representam construção musical, mas não há um
  evento harmônico persistido com identidade e intervalo temporal. Graus e
  funções hoje são derivados do campo tonal e das tríades MIDI simultâneas.
- `opendaw_mapping.js` recusa mais de uma faixa. O motor cria instrumentos para
  as faixas mapeadas e expõe `position`, `setPosition`, `play` e `stop(reset)` no
  SDK local. O adaptador Bardian ainda oferece somente `play/stop`.
- O piano roll da página ativa tem HTML/canvas e controlador, mas suas regras
  estruturais `.piano-roll-*` ficaram nas folhas movidas para `app/legacy`.
- O layout global injeta uma sidebar fixa de 218 px inclusive na harmonia.

As observações sobre `Teste 1` vêm do levantamento original; esta revisão não
consultou novamente o banco. A reprodução deve usar uma fixture determinística
com os eventos descritos, sem depender do nome ou ID de um registro local.
O código atual confirma as restrições de faixa única e tríades.

## 1. Blocos harmônicos e realização sonora

O documento musical persistido continua sendo a fonte de verdade, mas passa a
separar **o acorde declarado** de **como ele soa**. Um campo harmônico opcional
contém blocos ordenados. Cada bloco guarda ID estável, `onset_tick`,
`duration_ticks` e identidade do acorde por fundamental escrita e qualidade
(`major`, `minor` ou `diminished` nesta etapa). Por exemplo:

```json
{"harmony":{"blocks":[{"id":"acorde-1","onset_tick":0,
  "duration_ticks":960,"chord":{"root":"C","quality":"major"}}]}}
```

O campo é opcional no contrato JSON versão 1 para que composições existentes
continuem legíveis. `Music::Composition.from_h/to_h` deve validar e preservar os
blocos, seus IDs e sua ordem. Não persistir grau, função ou recomendação: esses
valores são derivados do acorde declarado e da tonalidade atual, usando as
regras musicais compartilhadas. Trocar a tonalidade reinterpreta a função, sem
trocar o acorde ou suas notas.

Os IDs dos blocos não podem colidir com IDs de composição, faixa, região ou
nota. Blocos são contíguos a partir do tick zero, não se sobrepõem, têm duração
de 240, 480, 960 ou 1920 ticks e respeitam o limite atual de 32. A fundamental
usa uma grafia musical válida para o domínio existente. O próximo bloco começa
no fim do último bloco declarado; o número de notas MIDI não limita essa ação.
Um documento vazio pode receber o primeiro bloco sem etapa de recuperação.

### Contrato e compatibilidade

- Distinguir ausência de `harmony` (legado) de `harmony: { blocks: [] }`
  (declaração explicitamente vazia). Lista vazia não reativa inferência. `null`,
  tipos incorretos e blocos inválidos são erros, nunca motivo para apagar o campo
  ou tratar o documento como legado.
- Inícios são inteiros não negativos; durações são inteiros da lista permitida.
  Rejeitar strings numéricas, frações e somas fora dos inteiros seguros do
  JavaScript. A ordem recebida deve ser cronológica; não ordenar silenciosamente
  um documento inválido. Validar unicidade dos IDs no documento completo,
  inclusive contra faixas que não aparecem na projeção.
- `root` é nome escrito sem oitava, validado pelo domínio; não substituir a grafia
  persistida por classe MIDI. Qualidade inválida não recebe valor padrão. Acorde
  fora do campo mantém sua cifra, com grau/função ausentes e explicação adequada,
  sem impedir edição ou escuta.
- O limite de 32 é de blocos, não de notas ou compassos. Notas livres conservam
  as durações admitidas pelo contrato MIDI, pitch 0–127 e velocity 1–127.
- A extensão opcional permite ao código novo ler documentos antigos; não garante
  preservação por escritores antigos. Auditar todos os caminhos de gravação,
  inclusive CRUD e editor genérico, para impedir que removam `harmony`.

### Realização e associação temporal

A faixa `harmony-<id>` guarda a **realização** do acorde: tríade simultânea,
voicing livre e, futuramente, notas distribuídas como arpejo. A faixa opcional
`harmony-extra-<id>` guarda notas independentes, como um baixo ou ornamento
manual. Notas conservam ID, pitch, início, duração e velocity. Ambas as faixas
compartilham inicialmente o timbre escolhido na barra compacta; a reprodução
ouve as duas. O papel da faixa adicional não determina a identidade do acorde. Criar a faixa
adicional copia o timbre atual da realização; mudar o seletor atualiza ambas.
Se uma composição já tiver timbres diferentes, abrir a página não os iguala:
mostrar estado misto até uma escolha explícita.

`HarmonyLane` passa a projetar sua timeline e as sugestões pelos blocos
declarados, não pela simultaneidade das notas. Acrescentar ou mover uma nota no
piano roll não remove o bloco nem desabilita `Adicionar acorde`. O usuário vê
`Acorde declarado` e, se as alturas soarem diferentes da tríade nominal,
`Notas editadas`; a explicação teórica identifica a declaração como tal, sem
afirmar que todas as notas ouvidas pertencem ao acorde. Uma nota criada na
camada `Acordes` deve iniciar dentro de um bloco existente. Fora dele, a
interface pede um bloco novo ou a camada `Notas adicionais`. Não inferir um
acorde novo a partir de uma nota solta. Mesmo que o usuário apague todas as
notas da realização ou as transforme em um arpejo, o bloco e sua identidade
permanecem; a interface indica quando o bloco está sem notas na realização.

Nesta etapa, notas da faixa de realização pertencem ao bloco que
contém seu início, no intervalo semiaberto `[início, fim)`: uma nota exatamente
no fim pertence ao próximo bloco, se existir. Reordenar blocos desloca os
inícios dessas notas pela mesma diferença; duração, altura, velocity e IDs não mudam. Notas adicionais ficam no
tempo absoluto. Redimensionar um bloco escala os inícios relativos e as durações
de todas as suas notas pela razão entre a duração nova e a antiga, inclusive
ornamentos e caudas. A região cobre o maior fim entre blocos e notas.
O vínculo continua sendo determinado pelo início; não há associação persistida adicional.

### Operações que precisam ser atômicas

Cada operação valida uma cópia antes de substituir o rascunho. Falha não deixa
blocos, notas, seleção ou histórico parcialmente alterados. Seleção e comandos
usam ID do bloco; índices servem apenas para apresentação.

| Operação | Regra e proteção |
| --- | --- |
| Adicionar | Criar declaração e realização juntas, com IDs novos. Calcular início pelo fim dos blocos, mesmo com notas adicionais mais longas. Validar o limite do lote inteiro antes de aplicar uma prévia. |
| Mover bloco | Capturar as notas de cada bloco antes da mudança; deslocar cada grupo pelo delta entre início antigo e novo, mantendo seu offset interno. Nunca reagrupar notas enquanto move os blocos. |
| Redimensionar | Escalar início relativo e duração de todas as notas do bloco pela razão nova/antiga, preservando pitches, velocity e IDs. Deslocar sucessores e suas realizações pelo delta de duração. Arredondar ao tick inteiro mais próximo, com duração mínima de 1 tick e início relativo limitado ao último tick do bloco. Notas adicionais permanecem no tempo absoluto. |
| Mover nota | Recalcular associação pelo início somente após o gesto. Mover para outro bloco existente muda sua associação; soltar fora de todos os blocos restaura a posição anterior. Não converter automaticamente para nota adicional. |
| Remover bloco | Remover sua declaração e suas notas de realização, com indicação prévia do efeito e possibilidade de desfazer; fechar o intervalo deslocando os sucessores. Preservar notas adicionais e notas sustentadas de blocos anteriores. |
| Apagar notas | Manter a declaração, inclusive ao remover todas as notas do bloco. Não recriar a tríade automaticamente. |

Exemplo: bloco A ocupa `[0, 960)` e tem nota em 720 com duração 600.
Ao reduzir o bloco para 480, essa nota passa a iniciar em 360 e durar 300;
continua associada a A e mantém proporcionalmente sua cauda além do bloco.
Ao ampliar um bloco de 1 para 2 tempos, uma nota de meio tempo passa a durar
1 tempo e seu início relativo também dobra.

A opção proporcional foi aprovada pelo autor em 21/10/2026. Ela substitui a
regra anterior que ajustava apenas notas terminadas no limite antigo. A edição
direta no piano roll continua livre; a transformação acontece apenas ao mudar
a duração do bloco. Arredondamento pode perder precisão em reduções sucessivas;
desfazer restaura o snapshot original sem essa perda.

Desfazer/refazer deve restaurar uma operação inteira: declarações, faixas,
regiões e notas afetadas. O histórico atual somente de notas de uma região não
serve para recuperação, remoção ou reordenação. Trocar de camada ou painel não
apaga o histórico nem restaura notas de outra camada. Após nova edição, invalidar
redo. Cursor e estado de áudio não fazem parte do documento desfeito.

`Notas editadas` significa diferença entre o conjunto de classes de altura da
realização associada e o da tríade declarada, ignorando oitavas, duplicações e
ordem temporal. Arpejar as mesmas alturas não altera a identidade. Usar rótulo
`Sem notas na realização` para grupo vazio; mute/solo/volume são estados de
reprodução separados. Notas adicionais não entram nessa comparação.

## 2. Recuperação de composições existentes

Documentos sem blocos declarados continuam legíveis. No GET, a aplicação pode
projetar blocos candidatos a partir das tríades simultâneas atuais, sem gravar
ou apagar nada. Uma proposta automática só aparece quando cada posição tem um
único conjunto de três IDs de notas com mesmo início e duração permitida,
formando uma tríade reconhecida, e esses conjuntos cobrirem blocos contíguos
desde zero; as demais notas são
propostas como adicionais. Em `Teste 1`, C4/E4/G4 de 960 ticks formam o bloco
C e C3 de 480 ticks fica como nota adicional. O usuário confirma a separação
e salva com `lock_version`; nenhum dado é reescrito apenas por abrir a página.

Se a análise encontrar mais de um trio possível ou não puder determinar a
fundamental e a qualidade, a interface pede ao usuário o acorde declarado e
quais notas pertencem à realização. Não grava um palpite. Desfazer antes de
salvar restaura documento e notas anteriores. Após a primeira gravação dos
blocos, sugestões e timeline leem os IDs e acordes declarados; alterações no
piano roll não reexecutam a inferência antiga.

O piano roll oferece seleção clara entre `Acordes` e `Notas adicionais`; cada
uma edita apenas sua faixa. A visualização combinada e a reprodução usam as
duas. A faixa adicional só é criada quando há conteúdo. Faixas não relacionadas
à harmonia, loop e metadados suportados são preservados no merge. BPM só muda
quando editado explicitamente.

### Recuperação, projeção e gravação sem perda

- A inferência examina somente a faixa de harmonia reconhecida, nunca as faixas
  externas. Unicidade é da sequência completa de candidatos, não um palpite local
  guloso. Mais de um conjunto de IDs, mesmo com a mesma cifra, é ambiguidade.
  Não escolher por volume, oitava ou ordem no array. Interromper busca ambígua
  sem enumerar combinações indefinidamente.
- MIDI não determina grafia enarmônica. A proposta usa a grafia do contexto tonal
  quando houver correspondência única; fora dele, solicita declaração explícita.
  A recuperação manual só confirma quando blocos e associação satisfazem todas
  as invariantes. Lacunas não são preenchidas com acordes inventados.
- A confirmação no rascunho e a persistência são passos distintos. Cada nota
  original deve aparecer exatamente uma vez na separação, com os mesmos dados e
  ID. Cancelar ou desfazer restaura o estado anterior. Até a confirmação, não
  habilitar operações que dependam de blocos declarados.
- As duas faixas são identificadas por IDs, nunca por `tracks[0]`/`tracks[1]`.
  Cada faixa gerenciada mantém nesta etapa uma região iniciada em zero. Estruturas
  diferentes recebem mensagem de incompatibilidade; não achatar regiões nem
  descartar conteúdo automaticamente. Faixas externas continuam preservadas.
- A faixa adicional ausente é uma camada vazia virtual. Criá-la no primeiro
  conteúdo, com IDs sem colisão; se já existir e ficar vazia, conservar seus IDs
  e propriedades. A projeção de gravação representa integralmente as duas faixas
  gerenciadas: ausência da adicional significa ausência desejada, não campo
  omitido de um PATCH parcial. Rejeitar payload que remova uma adicional salva
  com notas; mantê-la explicitamente vazia ao apagar todas as suas notas.
- O merge aceita alterações somente em blocos, nas faixas gerenciadas, BPM e
  contexto autorizados. Validar identidade da composição, compasso e catálogo
  de instrumentos. Rejeitar IDs de faixas inesperados e colisões após o merge.
  Nome, loop e faixas externas vêm da versão persistida, não do cliente.
- Preservar propriedades válidas do contrato, incluindo volume/mute/solo, e
  documentar os campos aceitos: “demais metadados” não promete suporte irrestrito
  a chaves desconhecidas que `to_h` descarta. Se houver extensões desconhecidas
  no documento, bloquear a gravação com explicação em vez de removê-las.
- Validar e salvar o conjunto em uma única atualização protegida pelo optimistic
  locking. Versão ausente/inválida: 422; conflito: 409; documento inválido: 422.
  Conflito mantém o rascunho e não tenta sobrescrever com versão nova automática.
  Manter escopo por usuário e proteção CSRF dos endpoints atuais.
- Capturar revisão e snapshot ao salvar. A resposta atualiza `lock_version`, mas
  só marca limpo o snapshot enviado; edições posteriores continuam pendentes.
  Erro de rede, sessão expirada ou resposta não JSON mantém o rascunho e permite
  nova tentativa. Respostas de análise antigas não substituem uma revisão nova.

Guardar apenas faixas separadas não resolveria os arpejos: ainda seria preciso
adivinhar o acorde a partir do início simultâneo das notas. Continuar inferindo
o acorde a cada edição perderia a identificação assim que as notas fossem
distribuídas no tempo. Os blocos declarados são a decisão de modelagem deste
sprint; a faixa adicional separa conteúdo sonoro que não realiza o acorde.

## 3. Agulha em “Sua sequência” e no piano roll

Um cursor temporal pertence ao shell da página de harmonia, fora dos Turbo
Frames. Ele aparece sempre na seção **Sua sequência**, sobre uma régua alinhada
aos blocos e dentro da rolagem horizontal, inclusive quando o piano roll está
fechado. O cursor também aparece no piano roll quando o editor está aberto.
As duas representações mostram o mesmo tick musical, sem salvar essa posição
no documento.

Clique ou toque na régua desloca o cursor para o tempo escolhido; arrasto da
agulha permite ajuste contínuo. O destino é limitado ao início e fim da música
e expresso em ticks do contrato musical. A seção rola horizontalmente para
manter a agulha visível durante a reprodução, sem deslocar a página inteira.
Foco e teclado oferecem forma equivalente de posicionamento; uma indicação
textual informa compasso e tempo para quem não usa a linha visual.

O adaptador openDAW transmite posições observadas em PPQN para o shell, que
converte para os 480 ticks por semínima do documento. Pausar conserva a
posição; retomar continua dela sem recriar a composição. Parar encerra as notas
e volta ao início. Ao chegar ao fim, o cursor volta ao início e o transporte
fica parado. Trocar notas, duração, timbre ou composição interrompe a execução
antiga sem perder as edições. Uma análise atrasada ou carregamento de áudio
cancelado não pode reiniciar a música.

Espaço alterna entre reproduzir e pausar na página de harmonia. Não captura
Espaço em campos editáveis, links, botões, selects, elementos com papel de botão
ou quando modificadores estiverem pressionados. Repetição automática da tecla
não provoca múltiplas alternâncias. O piano roll incorporado usa o transporte
do shell; seu atalho local de áudio fica desabilitado nessa página.

### Relógio, extensão e estados do transporte

O fim navegável é `max(fim dos blocos, fim das notas das duas faixas)`, ou zero
sem conteúdo. Regiões devem cobrir seus eventos e a extensão harmônica; uma
região vazia pode manter duração mínima técnica positiva sem aumentar o fim
navegável. Sustentações e notas adicionais após o último bloco aparecem na régua.
Nesta página, “reproduzir” ouve somente as duas faixas de harmonia, respeitando
volume/mute/solo; outras faixas são preservadas, mas não reproduzidas. Loop salvo
é preservado e fica inativo nesta escuta, que termina uma vez no fim definido.
O controle principal usa o rótulo `Ouvir harmonia` para explicitar esse alcance.

| Estado/ação | Resultado esperado |
| --- | --- |
| Parado ou pausado + reproduzir | Iniciar no cursor. Reutilizar sessão preparada se documento e timbre não mudaram. |
| Reproduzindo + pausar | Silenciar notas, conservar cursor observado e sessão preparada. |
| Qualquer estado + parar | Cancelar início pendente, silenciar e voltar a zero. Repetição é segura. |
| Carregando + pausar | Cancelar intenção de tocar, mantendo cursor; conclusão do carregamento não inicia áudio. |
| Seek parado/pausado | Atualizar cursor sem iniciar áudio. |
| Seek reproduzindo | Silenciar eventos antigos e continuar do destino, sem duas execuções simultâneas. |
| Seek carregando | Guardar somente o destino mais recente; tocar ali apenas se a intenção de reproduzir continuar válida. |
| Chegada ao fim | Silenciar, parar e voltar a zero uma única vez; seek ao fim durante reprodução segue a mesma regra. |
| Reproduzir com cursor no fim | Começar em zero. Com fim zero, ação desabilitada. |
| Edição musical, BPM ou timbre | Invalidar sessão/solicitações antigas e parar sem auto-retomada; conservar cursor limitado ao novo fim. |
| Troca de composição ou saída | Encerrar áudio, inscrições e callbacks; a nova composição começa em zero. |
| Falha de áudio | Exibir erro recuperável, conservar documento e cursor; nova tentativa exige ação do usuário. |

Para notas sustentadas, ao retomar ou buscar um ponto interno de uma
nota (`início < destino < fim`), rearticulá-la pela duração restante. Nota com
fim igual ao destino não toca; nota com início igual ao destino toca uma vez.
Isso não reproduz a fase original do envelope, limitação explícita deste sprint.
Verificar o SDK instalado antes de implementar; se não suportar esse contrato,
registrar a limitação e discutir alternativa, sem fingir continuidade sonora.

Converter posição por `ppqn = tick * PPQN.Quarter / 480` e
`tick = ppqn * 480 / PPQN.Quarter`, sem assumir que PPQN é 960. Validar unidade
e faixa do SDK. Manter precisão no desenho, arredondando apenas a posição de
seek para tick inteiro e limitando-a a `[0, fim]`. O relógio de áudio é a fonte
da posição durante execução; animação visual não acumula ticks por frames ou
por temporizador. BPM altera segundos, não coordenadas musicais.

O shell mantém cursor, revisão musical, intenção de transporte e identidade da
sessão. Promessas e callbacks conferem essa identidade antes de publicar posição,
erro ou fim. `AbortController` sozinho não protege carregamentos não abortáveis.
Encerrar observers, animações e handlers em `disconnect`/`turbo:before-cache`;
reconectar não duplica atalhos nem reproduz automaticamente. Abrir/fechar um
Turbo Frame hidrata o rascunho atual, sem recriar transporte.

Pré-escuta de acorde e prévia gerada devem ser isoladas da sessão principal:
pausar a principal, manter seu cursor e não retomar automaticamente ao terminar.
A pré-escuta não inclui acidentalmente notas adicionais nem atualiza a agulha
principal com seu relógio; callbacks de fim antigos não param a sessão nova.

### Coordenadas e acessibilidade

Régua e blocos devem compartilhar escala temporal proporcional à duração,
sem somar gaps, cabeçalhos e padding como se fossem tempo. Em cada painel,
calcular coordenadas considerando origem do conteúdo, rolagem, escala/zoom e
largura reservada ao teclado. Mesma posição musical pode ter pixels diferentes
entre painéis. Redimensionamento não muda o tick selecionado.

Durante arrasto, usar captura de ponteiro; `pointercancel` restaura a posição
anterior ao gesto. Não disputar o gesto com mover notas ou reordenar acordes.
Suspender auto-rolagem durante interação manual; retomá-la ao encerrar o gesto.
Teclado na régua: setas movem 120 ticks, Home vai a zero, End vai ao fim, sempre
limitados ao intervalo. Expor mínimo, máximo, valor e texto musical acessíveis;
não anunciar posição a cada frame. Ignorar Espaço também em `contenteditable`,
ancestrais editáveis e eventos já consumidos. Manter a restrição atual a 4/4
explícita; outros compassos recebem mensagem, sem renderização incorreta em 4/4.

## 4. Página e piano roll

A sidebar global deixa de aparecer **somente na página de harmonia**. A área de
composição usa a largura disponível e apresenta, no topo, caminho de volta à
composição/biblioteca, nome, salvamento, tema e conta. Biblioteca, CRUD e
autenticação conservam a navegação atual. O layout condicional não altera as
rotas nem os cabeçalhos COOP/COEP exigidos pelo áudio.

O piano roll ativo recebe as regras essenciais de grade, régua, teclado,
velocity, notas, agulha e controles, adaptadas aos tokens claros/escuros da
harmonia. Não se reativa a folha inteira de apresentação nem estilos das telas
legadas. A distinção entre acorde e nota adicional deve ser visível por rótulo
e cor discreta. O painel de edição mantém rolagem interna, acesso por teclado,
foco visível e dimensões utilizáveis em desktop e celular.

## Responsabilidades e arquivos prováveis

- `app/models/music/composition.rb` e um objeto de bloco harmônico próprio:
  validar/serializar a declaração de acordes sem misturar dados MIDI.
- `app/models/composition_harmony.rb`: projetar e mesclar blocos e as duas
  faixas reconhecidas, preservando outras faixas e IDs.
- `app/models/music/harmony_lane.rb` e `harmony_generator.rb`: projetar
  blocos declarados, graus, funções e sugestões pelo contexto tonal.
- `app/javascript/composition/harmony_draft.js` e
  `app/javascript/composition/harmony_editor.js`: operações por papel sem
  alterar a fonte de verdade.
- `app/javascript/composition/opendaw_mapping.js`,
  `app/audio_engine/harmony_engine.js` e
  `app/javascript/audio/opendaw_harmony.js`: duas faixas, posição, pausa,
  retomada e seek.
- `app/javascript/controllers/harmony_controller.js` e
  `app/javascript/controllers/piano_roll_controller.js`: um estado de cursor,
  sincronização dos painéis e atalho de Espaço.
- `app/views/harmony/show.html.erb`, `_lane.html.erb`, `_toolbar.html.erb`,
  `_editor_panel.html.erb` e `_piano_roll_editor.html.erb`: hierarquia, régua,
  cursor, recuperação e seleção da faixa editada.
- `app/views/layouts/application.html.erb`,
  `app/views/shared/_product_navigation.html.erb`,
  `app/assets/stylesheets/productivity.css` e
  `app/assets/stylesheets/music_workspace.css`: layout sem sidebar na harmonia
  e estilo do piano roll ativo.

### Composição das views

`show` compõe navegação, toolbar, sequência e frame do editor e mantém o shell.
`_toolbar` recebe estado de salvamento/transporte e catálogo; `_lane` recebe
blocos projetados e extensão temporal; `_editor_panel` organiza seleção de
camada e mensagens; `_piano_roll_editor` recebe configuração de apresentação e
é hidratado pelo rascunho do shell. Recuperação pode ter partial próprio se o
formulário justificar, recebendo candidatos já analisados. Controllers/modelos
resolvem acesso, consultas, merge e regras musicais; partials não inferem acordes
nem consultam banco. A revisão de implementação deve conferir essas fronteiras.

## Verificação e entrega

Testes de domínio e persistência devem provar que `Teste 1` pode ganhar blocos
declarados sem perder C3, que a sequência reaparece, que um novo acorde pode
ser adicionado e que alterações no piano roll não apagam nem mudam a identidade
do acorde. Um acorde C continua C com notas arpejadas em tempos diferentes;
trocar a tonalidade recalcula grau e função. IDs, faixas externas e metadados
são preservados, inclusive após reabrir. Casos ambíguos pedem declaração
explícita. Testes JavaScript cobrem troca da faixa editada,
conversão de ticks/PPQN, seek, pausa, retomada, fim, carregamento cancelado e
Espaço com/sem foco em controles. Build de áudio e `zeitwerk:check` continuam
obrigatórios.

No navegador, verificar em desktop e celular: a sidebar ausente na harmonia,
agulha visível em **Sua sequência** com o piano roll fechado, sincronia ao abrir
o editor, clique/arrasto na régua, Espaço para pausar/retomar, som das duas
faixas, salvamento e reabertura. Confirmar que a rolagem horizontal acompanha o
cursor e que o piano roll está legível nos dois temas. A escuta de qualidade
dos timbres permanece avaliação humana.

### Matriz mínima de regressão

Os cenários abaixo verificam riscos concretos; a aprovação exige resultado
observável, não apenas ausência de exceção.

| Cenário | Resultado esperado / risco coberto |
| --- | --- |
| Round-trip legado, `blocks: []`, inválido e 32/33 blocos | Ausência preservada, vazio não inferido, inválidos rejeitados e limite consistente em Ruby/JS. |
| Fixture de `Teste 1` | Recuperação dos 10 blocos, preservação de C3 e de todos os IDs; adicionar o 11º acorde e reabrir sem perda. GET não altera documento nem versão. |
| Dois trios possíveis, duplicação de oitava e grafia ambígua | Nenhum palpite gravado; confirmar/cancelar/desfazer preserva exatamente o conjunto de notas. |
| Acorde arpejado, fora do campo e sem notas | Declaração persistente, cifra correta, avisos distintos e ausência de função inventada. |
| Mover/redimensionar/remover com notas internas e sustentadas | Associação calculada antes da operação; nota em 720 num bloco de 960 passa a 360 ao reduzir para 480; duração escala proporcionalmente; adicionais ficam no tempo absoluto. |
| Faixas em ordem invertida, adicional vazia e IDs colidindo com faixa externa | Seleção por ID, nenhuma perda de dados e colisão rejeitada no servidor. |
| Salvar pelo CRUD/editor genérico após criar blocos | Blocos, loop e propriedades suportadas sobrevivem ao round-trip. |
| Duas abas salvam a mesma versão; edição durante PATCH | Uma atualização conflitante retorna 409 sem sobrescrever; edição posterior ao snapshot continua pendente. |
| Undo/redo após recuperação e troca de camada | Restaura documento completo sem copiar notas para a camada errada. |
| Pausa/seek no meio de nota, no limite e após última tríade | Notas iniciam/terminam conforme contrato, sem duplicação, notas presas ou corte prematuro da faixa adicional. |
| PPQN distinto de 960, BPM diferente e seek repetido | Conversão reversível, sem deriva acumulada; último destino prevalece. |
| Play→stop antes do load; play→editar; seek→seek; sair durante load | Nenhum callback antigo inicia áudio ou altera a posição/estado da sessão atual. |
| Pré-escuta após reprodução principal e fim de prévia atrasado | Cursor principal preservado e sessão nova não encerrada por callback antigo. |
| Frame reaberto, navegação Turbo e duas reconexões | Um transporte, um conjunto de observers/atalhos, sem som após saída. |
| Régua rolada, zoom/redimensionamento, toque e cancelamento | Mesmo tick nos dois painéis e destino correto independente da geometria. |

Testes de domínio e operações usam fixtures sintéticas; concorrência usa testes
de request/model e promessas controladas no JavaScript. Verificar pausa/seek e
notas sustentadas também com o SDK real: mocks não comprovam semântica sonora.
Build e testes devem usar dependências já instaladas, sem atualização incidental.
Esta revisão é documental e não equivale à execução dessa matriz.

### Etapas concluíveis e decisões aprovadas

1. Contrato e recuperação: validar round-trip, merge e fixture de `Teste 1`.
2. Operações e editor: validar associação temporal, histórico e duas camadas.
3. Transporte e interface: validar SDK real, estados, régua e ciclo Turbo.

Cada etapa exige implementação autorizada e verificações próprias. Registrar no
DevReport somente funcionalidades implementadas, verificadas e com rota de teste;
esta revisão de especificação não é entrega funcional.

As quatro escolhas abaixo foram **aprovadas explicitamente pelo autor nesta
conversa**, após apresentação dos efeitos e alternativas. A primeira recebeu
uma atualização posterior em 21/10/2026: todas as notas da realização
acompanham proporcionalmente o bloco, conforme a opção escolhida pelo autor.

1. **Redimensionar escala o conteúdo musical do bloco.** Inícios relativos e
   durações acompanham a razão nova/antiga, inclusive notas internas e caudas.
   Arredondar ticks mantém duração positiva e início dentro do bloco. Alturas,
   intensidades e identidades permanecem iguais; notas adicionais ficam no
   tempo absoluto. O vínculo persistido nota/bloco continua fora desta etapa.
2. **Excluir remove o bloco e sua realização.** Informar o efeito antes da ação,
   permitir desfazer integralmente e recuar sucessores e suas notas para fechar
   o intervalo. Notas adicionais permanecem no tempo absoluto; não receberão
   automaticamente as notas removidas.
3. **Retomar/seek rearticula sustentadas pela duração restante.** Há novo ataque,
   sem reconstrução do envelope anterior. Pré-escuta pausa a execução principal,
   conserva seu cursor e exige retomada manual. Antes de implementar, confirmar
   esse comportamento no SDK instalado. Se inviável, apresentar a limitação ao
   autor e decidir uma alternativa antes de alterar o contrato aprovado.
4. **Ouvir harmonia reproduz somente as duas faixas gerenciadas.** Respeitar
   volume/mute/solo dessas faixas, manter loop salvo inativo e preservar as demais
   faixas sem reproduzi-las. O rótulo do controle é `Ouvir harmonia`.

A aprovação acima encerra essas decisões de produto, mas não substitui a
verificação técnica do SDK nem autoriza iniciar a implementação nesta revisão.

## Fora do sprint

Não incluir gerador de arpejos, mixer, efeitos, novos instrumentos,
reconhecimento geral de acordes, exportação ou edição de faixas arbitrárias.
Não adicionar dependência nova nem alterar o banco de dados para esta
distinção de papéis. A associação de origem entre notas e um arpejo gerado é
uma extensão futura; o bloco e seu acorde declarado já existem neste sprint.
