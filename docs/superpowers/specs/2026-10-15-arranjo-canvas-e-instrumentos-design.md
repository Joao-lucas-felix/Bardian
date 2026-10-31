# Especificação: arranjo em Canvas e instrumentos iniciais

Data: 15 de outubro de 2026  
Estado: proposta para revisão do autor antes do plano de implementação.

## Propósito e recorte

A página `/criar` deve ajudar uma pessoa iniciante a enxergar uma música como
quatro partes alinhadas no tempo, abrir uma frase para editá-la e escutar a
frase com um som de instrumento. A referência visual enviada pelo autor mostra
faixas coloridas em uma linha do tempo; aqui a forma de onda será **ilustrativa**,
não uma gravação nem uma análise do áudio. O resultado deve parecer uma
ferramenta de composição acessível, sem acrescentar complexidade de DAW.

Continuam fixos o Trecho 1 de quatro compassos em 4/4, as camadas Harmonia,
Baixo, Melodia e Bateria, uma frase por camada, apenas um editor aberto por vez
e notas temporárias perdidas ao sair ou atualizar a página. A etapa anterior
já fornece a rota, os cards, o estado das frases e o piano roll; esta etapa
evolui essas partes, sem criar um modelo persistente de composição.

## Arranjo e navegação

Uma régua comum marca os quatro compassos. As quatro faixas aparecem como
linhas compactas, com identificador e função musical à esquerda e uma área
temporal de mesma largura e origem à direita. Cada frase ocupa o mesmo
intervalo. O cabeçalho visual da frase mantém cantos superiores arredondados
e inferiores retos; quando aberta, conecta-se ao editor logo abaixo.

Cada área temporal usa Canvas 2D para desenhar grade e forma de onda
ilustrativa a partir da distribuição dos eventos MIDI da própria frase.
Não se mostra onda quando não há notas; no lugar dela aparece um convite
curto para começar. A prévia não é tratada como áudio renderizado e não
guarda estado musical separado. A legenda acessível informa quantidade de
notas, trecho e camada. Um botão HTML sobre a frase oferece clique, foco,
Enter/Espaço, `aria-expanded` e `aria-controls`; o Canvas é decorativo e não
é a única forma de operar a faixa. A mesma escala temporal e o mesmo
alinhamento valem para desktop e celular, com rolagem horizontal da região
temporal em telas estreitas sem desencontrar régua e faixas.

A view principal organiza o cabeçalho, a régua e as quatro camadas. Partials
de camada e frase recebem apenas descritores de apresentação e identificadores;
não consultam dados nem calculam regras musicais. O controlador de criação
coordena seleção de frase, estado temporário e atualização da prévia. Um
desenhador de Canvas recebe dimensões e eventos MIDI, sem controlar áudio ou
editar notas.

## Editor compacto e fluxo de dados

O piano roll aberto mostra aproximadamente uma oitava por vez nas camadas
melódicas, com rolagem vertical para alcançar as demais alturas MIDI já
suportadas. Seu cabeçalho, barras de ferramentas e ajuda ficam mais compactos
na página de criação; o protótipo isolado em `/componentes` conserva seu uso.
Na Bateria, o editor apresenta somente três linhas rotuladas Bumbo, Caixa e
Chimbal. Os eventos conservam o mesmo formato MIDI em ticks utilizado hoje:
identificador, altura, início, duração e intensidade. Nesta etapa as alturas
36, 38 e 42 identificam, respectivamente, as três peças do kit. A duração
permanece nos dados e na edição, mas o som de bateria é disparado como ataque
curto, sem sustentação proporcional à duração.

Cada frase guarda em memória suas notas e a escolha de instrumento. Ao abrir
o piano roll, recebe cópias das notas e o identificador do instrumento; ao
confirmar uma edição, devolve um snapshot à página. Fechar e reabrir não
apaga esses dados. Mudar o instrumento mantém notas, alturas e duração
inalteradas; somente a reprodução e o rótulo sonoro mudam. Trocar de frase
interrompe imediatamente a reprodução anterior. A representação musical
permanece independente do Canvas e das amostras sonoras.

## Catálogo e reprodução

O catálogo inicial contém um instrumento por família: **Piano acústico**,
**Conjunto de cordas** e **Bateria básica**. Harmonia, Baixo e Melodia podem
selecionar piano ou cordas; Bateria usa o kit fixo. Não haverá um timbre
dedicado de contrabaixo nesta entrega. O padrão das três camadas melódicas
é piano. O piano usa a amostra Salamander já distribuída pelo projeto.
O conjunto de cordas usa uma pequena seleção local de amostras sustentadas
de seção de cordas da VSCO 2 Community Edition, e o kit usa um ataque local
de cada uma das três peças do Virtuosity Drums. As novas amostras serão
reduzidas ao necessário para a demonstração, com origem, autores, licença e
eventuais conversões registradas junto aos assets. Tanto a
[VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)
quanto o [Virtuosity Drums](https://shop.karoryfer.com/pages/free-samples)
são disponibilizados pelos produtores sob CC0; a amostra Salamander conserva
sua atribuição atual. Não se usa a coleção de bateria dos exemplos do Tone.js
sem origem e permissão próprias comprovadas.

O Tone.js já incluído no projeto carrega e toca as amostras locais após uma
interação do usuário. Um pequeno módulo de instrumentos traduz o identificador
selecionado e a altura MIDI em reprodução por sampler ou peça do kit; o piano
roll continua responsável pela sequência temporal da frase. Não se adiciona
uma nova dependência de reprodução. Se o carregamento ou início do áudio
falhar, a interface mostra uma mensagem específica e permite continuar
editando ou tentar reproduzir de novo. Não troca silenciosamente o instrumento
por um sintetizador. Carregamentos assíncronos terminados após fechar/trocar
a frase não devem iniciar áudio nem alterar a frase atual. Recursos de áudio
da instância encerrada são liberados.

## Verificação e limites

- Testar alinhamento temporal das quatro faixas, incluindo redimensionamento,
  tema claro/escuro e rolagem horizontal no celular.
- Testar estado vazio e prévia ilustrativa derivada de notas, além da
  descrição textual e abertura por mouse e teclado.
- Testar abre/fecha/troca de frase, preservação de notas e instrumento, e
  interrupção do áudio anterior.
- Testar que piano e cordas reproduzem alturas da frase, e que as alturas
  36/38/42 acionam bumbo, caixa e chimbal sem tocar as demais linhas.
- Testar carregamento, falha e término tardio das amostras; a edição deve
  permanecer funcional e sem perda de eventos MIDI.
- Verificar manualmente som e interface em navegador, além das suítes
  JavaScript e Rails afetadas. Após verificação, registrar a entrega em
  `config/dev_reports.yml` e rever se views/partials mantiveram apenas
  responsabilidades de apresentação.

Ficam fora desta etapa: áudio multifaixa simultâneo, salvar composição,
novos trechos, mais de uma frase por camada, arrastar clipes na linha do
tempo, renderizar uma forma de onda real, mixagem, exportação, timbre de
contrabaixo e ampliação do kit. A escolha de poucas amostras limita a
fidelidade do timbre em toda a extensão do teclado; isso deve ser indicado
como limite do protótipo, não ocultado como equivalência a um instrumento
completo.
