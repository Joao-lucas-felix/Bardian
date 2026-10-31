# Reprodução da composição e marcadores de loop — desenho da próxima etapa

Data: 16 de outubro de 2026. Estado: desenho aprovado em conversa; aguardando revisão do arquivo antes do plano de implementação.

## Intenção e resultado verificável

Na página de uma composição autenticada, a pessoa ouve o arranjo formado
pelas faixas e notas do documento musical atual, inclusive alterações ainda
não salvas. Pode tocar, pausar, retomar, parar, ouvir uma faixa isolada e
acompanhar a agulha na timeline. O intervalo entre dois marcadores pode se
repetir e é preservado ao salvar e reabrir. Editar enquanto toca não interrompe
o transporte: mudanças à frente da agulha entram na passagem atual; mudanças
em pontos já percorridos entram na próxima passagem.

Essa entrega fecha a ligação entre edição e escuta no fluxo demonstrável do
TCC. `/criar`, a reprodução individual do piano roll e o início do Caminho do
Bardo continuam disponíveis. Não há exportação de arquivo nem efeitos de
mixer nesta etapa.

## Abordagem e fronteiras

A abordagem escolhida é um reprodutor da composição, separado do piano roll.
Uma função pura transforma o documento em eventos com início absoluto em
ticks; um transporte mantém posição, ciclos e agendamento; a camada de áudio
executa os eventos com os instrumentos locais já existentes. A timeline
coordena os comandos e apresenta os estados. Ruby continua validando o
documento persistido, sem depender de Tone.js ou da interface.

Reaproveitar diretamente o transporte de cada piano roll exigiria sincronizar
vários editores de região e misturaria Canvas, gestos e áudio global. Criar
outro formato musical para o player duplicaria o domínio. A solução proposta
mantém o documento `Music::Composition` como fonte de verdade e introduz
somente adaptadores necessários. Não prevê nova biblioteca, serviço ou tabela.

Módulos potencialmente afetados: `Music::Composition`, operações puras de
`app/javascript/composition/`, um módulo de transporte/áudio em
`app/javascript/audio/`, o controlador Stimulus da composição, a view da
timeline e seus estilos. Testes Ruby, JavaScript e de renderização acompanham
essas alterações. As views apresentam controles e estado, sem consultar o
banco ou calcular regras musicais.

## Contrato do loop e compatibilidade

O documento versão 1 aceita opcionalmente
`"loop": { "start_tick": inteiro, "end_tick": inteiro }`. Ambos são ticks
absolutos, com `0 <= start_tick < end_tick`; valores inválidos são rejeitados
na validação, nunca corrigidos silenciosamente. A inclusão opcional é
retrocompatível: composições existentes sem `loop` continuam válidas e
mantêm o campo ausente até que a pessoa ajuste um marcador. Não há migração
de banco. O salvamento usa o `lock_version` já existente.

Sem marcadores explícitos, o intervalo automático vai de 0 até o fim da
última região; se não houver regiões, usa quatro compassos apenas para
mostrar a régua, sem iniciar áudio vazio. Ao criar ou remover regiões, esse
fim automático acompanha o arranjo. Com marcadores explícitos, o intervalo
permanece fixo mesmo que as regiões mudem; eventos fora dele não tocam no
modo loop. O fim pode ultrapassar a última região para incluir silêncio, e a
timeline expande a área visível para exibi-lo. Mudar BPM ou compasso não altera
os ticks dos marcadores. Arrastar ou ajustar numericamente os marcadores
aplica snap de batida, com alternativa de teclado e validação da ordem.

O loop inicia ligado na página. Desligá-lo toca uma vez o arranjo completo,
do tick 0 ao fim da última região; os marcadores permanecem salvos e visíveis.
Alterar marcadores durante a reprodução não para nem desloca a agulha: o novo
intervalo passa a valer na próxima volta. Se o loop estiver desligado, valerá
no próximo Play; ligá-lo durante a reprodução conclui primeiro a passagem
atual e entra no novo intervalo no retorno, sem salto imediato. Um intervalo
explícito sem notas audíveis mostra uma mensagem em vez de iniciar um
transporte silencioso sem indicação.

## Eventos, tempo e atualização durante a reprodução

Cada nota conserva `id`, `pitch`, `velocity` e `duration_ticks`. Seu início
absoluto é `region.start_tick + note.onset_tick`. O agendamento converte ticks
para segundos por `60 / (bpm * 480)`; posições musicais não dependem de
Canvas, largura ou zoom. Eventos de regiões e faixas sobrepostas são
simultâneos. Notas que cruzam o início ou o fim do loop tocam apenas a parte
interna do intervalo naquela passagem; não há ataque duplicado no limite.

O transporte agenda apenas uma janela curta à frente da agulha e volta a
consultar o documento após cada edição. Eventos futuros já preparados nessa
janela devem poder ser cancelados e reagendados; a atualização não pode
duplicar ataques. Para uma edição, considera-se a posição de início do evento
no ciclo atual: se ainda está à frente, a mudança entra agora; se já passou,
fica para o próximo ciclo. Notas que já começaram continuam até sua liberação
normal, mesmo se outra nota ou região for editada. Se o loop está desligado,
uma alteração atrás da agulha será ouvida no próximo Play. Desfazer/refazer
obedece à mesma regra. A agulha continua em movimento durante essas operações.

Pausar preserva o tick corrente e interrompe vozes e eventos futuros;
retomar agenda a partir desse tick, inclusive o restante das notas que
cruzam a posição de retomada. Parar libera recursos e volta ao início do
intervalo ativo. No fim da reprodução sem loop, o transporte para. Mudança
de BPM durante a execução conserva o tick da agulha e muda o tempo dos
eventos futuros; mudança de compasso atualiza a régua, não os ticks.

## Faixas, instrumentos e falhas

No modo composição, todas as faixas não silenciadas tocam. Se houver alguma
faixa em solo, somente as faixas em solo e não silenciadas tocam; mute tem
precedência sobre solo. O comando de ouvir uma faixa isolada seleciona
explicitamente uma faixa e ignora o solo das demais, mas respeita o mute da
própria faixa. Volume de 0 a 1 e velocity de 1 a 127 influenciam a intensidade
sem modificar os valores salvos. Mute, solo e volume são aplicados durante a
reprodução; silenciar uma faixa também silencia suas vozes já ativas.

Piano, cordas e kit de bateria reutilizam os assets locais. O instrumento
continua identificado pela faixa, não por cada nota. Uma faixa com instrumento
desconhecido ou cujo sample falhou fica sem som, é nomeada no aviso e não
impede as demais; nenhuma substituição de timbre acontece silenciosamente.
Se não houver eventos audíveis ou nenhuma fonte puder ser carregada, Play não
inicia e mostra motivo. Trocar instrumento durante a reprodução prepara a
nova fonte para eventos futuros; a faixa permanece identificada como
indisponível se o carregamento falhar. O controller libera fontes ao navegar
para fora da página e ignora conclusões assíncronas obsoletas.

## Interface e responsabilidades

`show.html.erb` mantém a estrutura da página; o partial da timeline recebe
controles de transporte e marcadores de loop. A página oferece botões com
nomes acessíveis para tocar/pausar, parar, ligar o loop e ouvir faixa isolada;
a régua mostra marcadores e agulha. Estado de carregamento, reprodução,
pausa, erro e faixas sem som aparece em texto com anúncio acessível. A
interação por teclado é alternativa ao arraste dos marcadores. Alterar
marcadores marca o documento como pendente e usa o salvamento JSON existente.

O controlador Stimulus coordena interface, documento e ciclo de vida; não
implementa conversão de ticks ou síntese. O adaptador de eventos é puro e
testável sem navegador. O transporte concentra relógio, loop, agendamento e
transições de estado. A camada de instrumentos concentra carregamento,
volume, disparo, cancelamento e descarte, mantendo o domínio musical livre de
detalhes de Tone.js.

## Verificação e aceite

- Testes Ruby: documento v1 antigo sem `loop`, ida/volta com marcadores,
  limites inválidos, persistência e reabertura, conflito de `lock_version`.
- Testes puros JavaScript: ticks absolutos, duração, velocity, sobreposição,
  seleção por mute/solo, recorte nas bordas do loop, fim automático e
  marcadores explícitos.
- Testes do transporte com relógio e instrumentos substituíveis: tocar,
  pausar, retomar, parar, faixa isolada, BPM ao vivo, volume, atualização
  antes/depois da agulha, desfazer/refazer, cancelamento sem ataques
  duplicados e edição de marcadores na volta seguinte.
- Testes da página: controles, estado acessível, salvamento, marcador por
  teclado e regressão de `/criar`, piano roll individual e Caminho do Bardo.
- Verificação manual no navegador: ouvir duas faixas simultâneas, editar
  antes e depois da agulha, perceber a próxima volta, manipular marcadores,
  pausar/retomar, mute/solo/volume e revisar foco, tema e responsividade.

A entrega termina quando uma composição salva ou ainda pendente pode ser
ouvida e editada continuamente, o trecho escolhido repete sem perder o
estado musical, e os marcadores reaparecem após recarregar. Limitações e
resultados devem ser registrados na documentação e em
`config/dev_reports.yml` após implementação e testes. Reprodução física
audível deve ser conferida pelo autor; testes automatizados não a comprovam.
