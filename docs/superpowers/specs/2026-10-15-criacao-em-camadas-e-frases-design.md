# Especificação: criação em camadas e frases MIDI

Data: 15 de outubro de 2026
Estado: proposta alinhada em conversa; aguardando revisão do documento antes do plano de implementação.

## Objetivo e vocabulário

Criar a primeira página de composição guiada do Bardian. A pessoa monta uma ideia
musical por partes, sem precisar encarar vários piano rolls de uma vez.

- **Trecho** é uma posição compartilhada na linha do tempo. Nesta etapa existe
  apenas o Trecho 1, com quatro compassos em 4/4, conforme o editor atual.
- **Camada** é uma função da música: Harmonia, Baixo, Melodia ou Bateria.
- **Frase** é o conteúdo MIDI de uma camada em um trecho. Cada combinação de
  camada e trecho possui um card e um conjunto independente de notas.

As quatro frases do Trecho 1 começam no mesmo ponto e poderão ser combinadas em
uma etapa posterior. Nesta primeira entrega, não há reprodução conjunta.

## Página e navegação

Uma nova rota `/criar` será a página de criação e receberá o destino principal
"Criar" da navegação. A chamada de criação da página inicial apontará para ela.
A rota `/componentes` continuará disponível como protótipo isolado do piano
roll; a nova página poderá oferecer um link secundário para esse protótipo.

A página terá um cabeçalho curto com o convite para montar a música por camadas,
uma indicação visível de que o trabalho ainda não é salvo e a identificação do
Trecho 1. Abaixo, quatro seções de camada exibem, cada uma, um card de frase.
O card contém nome da camada, identificação da frase, estado vazio ou prévia
visual das notas reais e controle explícito para abrir/fechar. A prévia não usa
notas inventadas. O cabeçalho do card tem cantos superiores arredondados e
inferiores retos; aberto, conecta-se visualmente ao piano roll logo abaixo.

A view principal organiza as seções. Um partial representa a camada e recebe
seu descritor de apresentação; outro representa o card e recebe identificador,
título e estado da frase. O piano roll existente permanece um componente
separado. Views e partials não consultam dados nem calculam relações musicais.
O controller da página fornece apenas os quatro descritores estáticos da
primeira etapa; não cria entidades musicais ou registros no banco.

## Interação e estado musical

Somente um card pode estar aberto por vez. Abrir outro fecha o editor anterior,
interrompe sua reprodução e coloca o piano roll sob o novo card. Fechar e reabrir
uma frase preserva suas notas enquanto a página permanece carregada. O controle
usa botão com `aria-expanded`, foco visível e nome que identifica a frase.
O layout deve funcionar em desktop e celular, com rolagem local do editor quando
necessária, e respeitar os temas claro e escuro já existentes.

Um controlador da página mantém, em memória, um mapa de notas por identificador
de camada e trecho. O piano roll recebe as notas da frase ativa ao ser montado
e comunica alterações confirmadas ao controlador da página. A prévia do card é
derivada desse mesmo conjunto de eventos MIDI, sem estado musical duplicado.
Cada nota mantém altura MIDI, início, duração e intensidade no formato em ticks
já usado pelo editor. A conversão para `@webmusic/score` continua responsabilidade
do piano roll; não haverá segunda definição de nota ou duração na view.

O editor atual supõe uma única parte, começa vazio e registra atalhos no escopo
da janela. A integração deve explicitar a entrada/saída das notas e garantir que
apenas a instância ativa controle teclado e áudio. O protótipo em `/componentes`
deve continuar funcionando sem depender da nova página. Não se altera o domínio
musical Ruby nesta etapa.

## Áudio e limites

Harmonia, Baixo e Melodia podem usar a reprodução temporária de piano já
disponível para escutar a frase aberta. Isso não representa timbres finais por
camada. A frase de Bateria pode ser vista e editada como eventos MIDI, mas seu
controle de reprodução ficará desativado e acompanhado de uma explicação:
sons de percussão ainda não estão disponíveis. Não tocar notas de bateria com
timbre de piano nem apresentar a bateria como funcionalidade sonora concluída.

O estado é perdido ao recarregar ou sair da página. Não haverá persistência,
exportação, adição ou remoção de trechos, reprodução simultânea das camadas,
instrumentos próprios por camada, mixer, efeitos ou novas dependências. O Trecho
1 fixo é um recorte demonstrável, não a definição definitiva de frase musical.

## Verificação e critérios de aceite

- Testar rota, navegação, quatro camadas e um card por camada no Trecho 1.
- Testar que abrir um card fecha o anterior e que o controle comunica o estado
  expandido corretamente a usuários de teclado e leitores de tela.
- Testar edição, troca e reabertura de duas frases: as notas não se misturam nem
  desaparecem, e cada prévia reflete apenas as notas de sua frase.
- Testar estado vazio, interrupção do áudio ao trocar de card e ausência de
  reprodução na Bateria. Se o carregamento do áudio falhar, a edição continua
  utilizável com uma mensagem clara.
- Preservar os testes do piano roll isolado em `/componentes`.
- Conferir manualmente a página em desktop e celular, nos dois temas, inclusive
  foco visível, rolagem do piano roll, prévia e resposta auditiva das camadas
  que podem tocar.
- Executar as suítes Rails e JavaScript afetadas e registrar a entrega
  verificada em `config/dev_reports.yml`.

## Responsabilidades e risco de escopo

O maior risco é tratar quatro editores independentes como se já houvesse uma
composição multifaixa consolidada. Esta etapa evita isso: mantém um editor ativo
e conjuntos de notas separados em memória, com limites explícitos. A montagem
conjunta da música e uma representação persistente de composição exigirão uma
decisão própria depois que o fluxo de frases for validado.
