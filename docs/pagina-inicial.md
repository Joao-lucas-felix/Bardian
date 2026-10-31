# Referência de desenvolvimento — página inicial do Bardian

> Esta referência registra a apresentação original. A direção visual atual,
> com navegação de produto, tipografia sem serifa e temas claro e escuro, está
> em [direcao-visual.md](direcao-visual.md).

Atualizado em: 12 de outubro de 2026.

Este documento reúne o direcionamento acordado para a apresentação do
projeto, o estado implementado e as propostas ainda em discussão. Serve
como referência para os próximos incrementos; não substitui a aprovação
de novas mudanças prevista no AGENTS.md.

## 1. Missão e posicionamento

O Bardian é uma plataforma para desenvolver músicas com apoio à criação,
integrando aprendizagem ao processo de composição. Ensinar música faz
parte da proposta, mas não resume a finalidade do projeto.

O usuário deve poder experimentar sons, desenvolver ideias, receber
sugestões, compreender suas escolhas e modificar o resultado. A geração
automática pode apoiar esse processo, mantendo o usuário como responsável
pelas decisões criativas.

A apresentação deve acolher especialmente pessoas com pouco ou nenhum
conhecimento musical, sem restringir o projeto exclusivamente a iniciantes.

### Linguagem para o público

- Preferir verbos concretos: criar, experimentar, ouvir, explorar e aprender.
- Explicar o apoio oferecido com expressões como “receber sugestões”.
- Evitar “assistida” como palavra central da mensagem pública: o termo foi
  considerado pouco amigável nesta apresentação.
- Reforçar o protagonismo do visitante: suas ideias, suas escolhas e suas
  composições.
- Apresentar recursos planejados como proposta ou possibilidade futura,
  sem sugerir que o editor e as sugestões já estão disponíveis.

## 2. Identidade visual acordada

A direção é um **ateliê musical**, com a atmosfera de um **caderno de
compositor** e referências a músicos e bardos.

- Fundo predominantemente branco, com marfim quente na cena do piano.
- Texto escuro e cores pastéis mais vivas nos elementos musicais, dosadas
  por opacidade para manter a mensagem em primeiro plano.
- Tipografia manuscrita: Caveat nos títulos e Patrick Hand no corpo,
  com arquivos locais. O uso integral de fontes manuscritas foi adotado
  para experimentação e pode ser reavaliado pela legibilidade.
- Referências a cordas, alaúde, roseta, pautas, notas e teclas de piano.
- Elementos SVG sobrepostos ao fundo e ao texto, com composição em camadas.
- Animações sutis e variadas; evitar uma esteira uniforme de notas ou uma
  sequência de ilustrações isoladas empilhadas.

A narrativa usa rolagem com sobreposição de cenas. Movimento é um recurso
de apresentação e deve preservar leitura, interação e preferência por
movimento reduzido.

## 3. Estrutura implementada

### Abertura

- Marca: Bardian.
- Apresentação curta: “Um ateliê para criar e aprender música”.
- Título: “Sua criatividade dá o tom.”
- Complemento: “Toda composição começa com uma ideia.”
- Link: “Explore a proposta”, levando à seção do primeiro som.
- Botão “Ir para o Bardian”, levando à dashboard em `/dashboard`.

O fundo reúne pautas e notas animadas, uma roseta estática discreta e cordas
centralizadas a 45 graus. As cordas se estendem pela tela, desaparecem
gradualmente nas extremidades e reagem à passagem do mouse. O dedilhado
das cordas é apenas visual.

Há controle para pausar as animações. O controller também considera
visibilidade da cena, visibilidade da aba e movimento reduzido.

### Primeiro som

- Identificação: “O primeiro som”.
- Título: “Uma nota abre possibilidades.”
- Piano interativo abaixo da mensagem.

Texto presente no ERB na data desta referência:

> Transforme suas ideias em música. No Bardian, você poderá experimentar
> sons, receber sugestões e construir suas composições, aprendendo a
> cada escolha enquanto cria — mesmo que esteja começando agora.

Esse texto posiciona a criação como atividade central e a aprendizagem
como parte dela. A formulação futura distingue a proposta do projeto
das funcionalidades já disponíveis na página.

### Processo criativo

Depois do primeiro som, a terceira seção explica o apoio à composição.
Seu título é **“Sua ideia, novos caminhos.”** e o texto aprovado é:

> Uma melodia, alguns acordes ou um ritmo podem ser o começo.
> O Bardian está sendo desenvolvido para oferecer sugestões
> que ajudem você a explorar possibilidades e dar forma à sua música.

> Você experimenta, adapta e escolhe o que faz sentido para sua criação.

O partial `_creative_process.html.erb` reutiliza a estrutura de cena e a
tipografia existentes. Esta etapa é explicativa, sem nova interação ou
animação própria. O texto mantém explícito que as sugestões estão em
desenvolvimento e que as decisões criativas pertencem ao usuário.

### O Caminho do Bardo

A quarta seção apresenta a futura trilha de aprendizagem musical, depois
do processo criativo. O formato acordado é uma sequência de lições;
os exercícios ficam para um incremento posterior.

Texto de apresentação implementado:

> Descubra a música, uma lição de cada vez. Comece pelos primeiros
> sons e avance pelos conceitos que vão ajudar você a entender
> suas escolhas e dar forma às suas ideias.

O complemento “Uma trilha de aprendizagem em desenvolvimento” informa
o estado atual. O partial `_bard_path.html.erb` reutiliza os estilos
existentes e ainda não oferece acesso a lições.

Ao final, o botão “Ir para o Bardian” leva à mesma dashboard oferecida
na abertura. Ele dá acesso à área principal, não a uma lição específica.

Como proposta para discussão, cada lição poderá reunir uma explicação
acessível, um exemplo que possa ser visto e ouvido e uma ligação com a
criação musical. A sequência sugerida é: notas e alturas → oitavas e
acidentes → intervalos → escalas → acordes → tonalidades → campos
harmônicos e graus → progressões.

Essa ordem ainda não é um currículo fechado. A posição de ritmo e duração,
o conteúdo de cada lição e a navegação entre elas precisam ser definidos.
Não foram implementados exercícios, controle de progresso ou regras de
desbloqueio de conteúdo.

### Piano da apresentação

- Duas oitavas, de Dó4 a Si5: 14 teclas brancas e 10 pretas.
- Teclas arredondadas, cores quentes, gradientes, sombra e transparência.
- Sem nomes escritos nas teclas, conforme decisão visual do usuário.
- Nomes acessíveis preservados nos atributos de acessibilidade. A mensagem
  de estado ainda identifica a nota acionada.
- Acionamento por clique, toque ou Enter/Espaço com a tecla focada.
- Hover, foco visível e destaque temporário durante a execução.
- Cada acionamento toca por 0,5 segundo, seguido pelo release configurado.
- Segurar Enter/Espaço não dispara repetição automática; a duração ainda
  não acompanha o tempo em que uma tecla fica pressionada.
- Em telas estreitas, rolagem horizontal local preserva o tamanho das teclas.
- Mensagens de carregamento e erro; o áudio só é iniciado após interação.

A reprodução usa Tone.js e um Tone.Sampler com o arquivo Salamander
`A4.mp3`. As demais alturas são obtidas por transposição desse sample.
Não foi necessário adicionar samples para as duas oitavas; a qualidade
do timbre nas alturas transpostas ainda merece avaliação auditiva.

O sampler e os temporizadores são liberados ao sair da página. O domínio
Ruby permanece independente de Tone.js e da interface.

### Entrada na plataforma

A rota pública `/dashboard` mantém uma área de trabalho com barra lateral
escura fixa no canto esquerdo. A navegação conserva a estrutura de workspace,
conhecimento e pesquisa, mas o conteúdo principal foi temporariamente limpo
para permitir uma nova definição da dashboard.

A interface usa tipografia sans-serif para reforçar a linguagem de ferramenta;
a fonte manuscrita permanece apenas na marca. Em telas estreitas, a barra
lateral se torna uma navegação horizontal para preservar a estrutura mínima.

## 4. Organização atual do código

Os caminhos abaixo são relativos à raiz do repositório.

| Arquivo | Responsabilidade |
|---|---|
| `app/views/pages/home.html.erb` | Define título/layout e reúne as quatro cenas. |
| `app/controllers/dashboard_controller.rb` | Renderiza a entrada da plataforma. |
| `app/views/dashboard/index.html.erb` | Apresenta o estado inicial da dashboard e o retorno à apresentação. |
| `app/views/pages/_opening.html.erb` | Organiza a abertura, mensagem e camadas decorativas. |
| `app/views/pages/_soundhole.html.erb` | Desenha a roseta estática. |
| `app/views/pages/_instrument_strings.html.erb` | Desenha os seis pares de cordas. |
| `app/views/pages/_ambient_music.html.erb` | Desenha pautas e notas decorativas. |
| `app/views/pages/_first_sound.html.erb` | Organiza o texto, a ressonância visual e o piano. |
| `app/views/pages/_creative_process.html.erb` | Explica o apoio à composição e a liberdade de escolha do usuário. |
| `app/views/pages/_bard_path.html.erb` | Apresenta a futura trilha de lições O Caminho do Bardo. |
| `app/views/pages/_piano.html.erb` | Desenha as teclas e associa cada uma à altura de reprodução. |
| `app/javascript/controllers/music_story_controller.js` | Controla animações e interação visual das cordas. |
| `app/javascript/controllers/piano_controller.js` | Carrega o instrumento, reproduz notas e informa estados. |
| `app/assets/stylesheets/presentation.css` | Define identidade, composição, animações e adaptação da página. |
| `test/controllers/pages_controller_test.rb` | Verifica as 24 alturas e atributos de acessibilidade renderizados. |
| `test/controllers/dashboard_controller_test.rb` | Verifica os dois links de entrada, a rota da dashboard e o retorno. |

Os partials atuais não recebem locals. A separação facilita a leitura,
mas o piano ainda não é um componente configurável para múltiplos usos:
as oitavas estão fixas, há estilos vinculados à apresentação e IDs SVG
que pressupõem uma instância por página.

## 5. Limites e decisões preservadas

- O piano reduzido poderá ser reutilizado em páginas de aprendizagem.
  Ele não substitui o piano roll previsto para edição futura.
- Os identificadores de notas no ERB configuram esta interface. Ainda não
  constituem um contrato de reprodução integrado às entidades do domínio.
- Pautas e notas do fundo são decoração, não eventos de áudio nem uma
  composição musical armazenada.
- Reorganizar os dados das notas decorativas continua adiado.
- Novas abstrações, configuração do piano e ampliação dos samples devem
  responder a uma necessidade concreta, em incrementos discutidos.

## 6. Continuação em discussão — ainda não aprovada

A mensagem da terceira seção foi aprovada e implementada conforme a seção 3.
Permanece em discussão uma sequência visual de notas que ganha elementos
ao longo da rolagem, mantendo a linguagem do caderno de compositor.
Essa animação ainda não foi aprovada nem implementada.

Antes de ampliar a página, definir:

1. Qual mensagem a ilustração deve comunicar e como acompanhará o texto.
2. Se vale acrescentar uma interação à seção atualmente explicativa.
3. Como evoluir a dashboard que recebe o visitante ao sair da apresentação.

## 7. Verificação dos próximos incrementos

Conforme o tipo de mudança, conferir:

- Correspondência entre texto público, missão e recursos disponíveis.
- Renderização ERB e preservação das 24 alturas quando o piano for alterado.
- Leitura e layout em desktop e celular, incluindo rolagem local do piano.
- Mouse, toque, foco por teclado e preferência por movimento reduzido.
- Carregamento, falhas, reprodução e liberação dos recursos de áudio.
- Avaliação auditiva pelo autor, pois mensagens de sucesso e testes Ruby
  não comprovam a qualidade nem a audibilidade da saída física.

Esta referência é documental; sua criação não representa uma nova rodada
de testes da aplicação. Atualizar as seções de estado conforme as decisões
forem aprovadas e implementadas, sem transformar rascunhos em requisitos.

## Referências relacionadas

- [Decisão inicial de áudio](decisao-audio.md): experimento com Tone.js,
  Salamander, distribuição local e licenças. Descreve a demonstração
  original de Lá4; este documento registra sua utilização posterior no piano.
- [Domínio musical](dominio-musical.md): referência do núcleo musical.
