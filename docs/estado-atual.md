# Estado atual do Bardian

Atualizado em: 14 de outubro de 2026.

Este documento registra o estado do projeto no início da reta final do TCC.
Ele descreve o que já existe, o que foi validado, o que permanece limitado e
quais frentes devem orientar os próximos passos. Não transforma protótipos em
requisitos concluídos.

## 1. Objetivo atual

O Bardian está sendo desenvolvido como uma plataforma de criação e aprendizagem
musical. A proposta é permitir que uma pessoa experimente sons, compreenda as
relações musicais envolvidas e evolua para a criação de composições, mantendo a
representação musical estruturada como base comum do sistema.

O projeto ainda está entre a consolidação dos fundamentos e a construção do
fluxo inicial de criação. A apresentação pública comunica a proposta; ela não
deve ser confundida com um editor musical já concluído.

## 2. Estado do domínio musical

O domínio Ruby possui as seguintes estruturas:

- `Note`: letra, acidente, oitava, grafia, posição cromática e transposição;
- `Interval`: análise da relação entre duas notas;
- `IntervalSpec`: descrição aplicável de um intervalo;
- `ScalePattern` e `Scale`: padrões e construção de escalas;
- `ChordPattern` e `Chord`: padrões de tríades e construção de acordes.

As estruturas são imutáveis e preservam a diferença entre grafia e equivalência
de altura. O domínio não representa duração, ritmo, intensidade, posição
temporal, tonalidade, campo harmônico, graus, progressões ou faixas.

As convenções detalhadas estão em [dominio-musical.md](dominio-musical.md).

## 3. Estado da aplicação

### Apresentação pública

A rota `/` reúne os caminhos de aprendizagem, criação e apresentação. A rota
`/apresentacao` apresenta quatro cenas: abertura, primeiro som, processo criativo
e `O Caminho do Bardo`. O piano permanece interativo; a direção visual atual
usa tipografia sem serifa e navegação comum às páginas.

A primeira lição do Caminho do Bardo está disponível em
`/caminho-do-bardo/notas`. Ela apresenta o Bardian como ferramenta de criação
e aprendizagem, usa uma oitava interativa de Dó4 a Si4 e explica o piano roll
por meio de um diagrama conceitual. A sequência imediata aborda notas, oitavas,
acidentes e intervalos; lições seguintes, exercícios e progresso ainda não
foram implementados.

As superfícies públicas passaram a compartilhar tokens visuais e alternância
entre tema claro e escuro. A preferência é salva no navegador e, na ausência de
uma escolha anterior, acompanha a preferência de tema do sistema. A revisão
visual posterior unificou a navegação, os ícones e a tipografia sem serifa nas
áreas de criação e aprendizagem. A direção e seus limites estão registrados em
[direcao-visual.md](direcao-visual.md).

O piano da apresentação cobre duas oitavas, de Dó4 a Si5. Possui interação por
clique, toque e teclado, mensagens de estado e suporte básico a movimento
reduzido. Os textos deixam explícito quando um recurso ainda está em
desenvolvimento.

### Dashboard

A rota `/dashboard` mantém uma barra lateral contextual e apresenta uma tabela
de entregas verificáveis do desenvolvimento. O
catálogo versionado em `config/dev_reports.yml` contém as entregas concluídas:
título, descrição curta, alterações, data, tags e link interno de teste. Há
busca por texto, filtro por tag e detalhes expansíveis.

A interface segue a mesma tipografia e os mesmos temas do restante do produto.
Em telas estreitas, a barra lateral se transforma em uma navegação horizontal
e a tabela pode ser rolada horizontalmente. A tela não guarda composições ou
dados pessoais.

### Autenticação

O sistema usa Devise com um único modelo `User` e as roles `user` e `admin`.
O cadastro público cria somente usuários comuns. A dashboard é protegida no
controller e aceita apenas administradores autenticados.

O administrador inicial é criado pelo `db/seeds.rb` usando `ADMIN_EMAIL` e
`ADMIN_PASSWORD`. O seed é idempotente e falha quando qualquer uma das
variáveis está ausente. Recuperação de senha, confirmação de e-mail, MFA e
OAuth ainda não fazem parte do escopo.

### Reprodução de áudio

A rota `/audio_demo` valida a reprodução de uma nota usando Tone.js local e um
sample `A4.mp3` do Salamander Grand Piano. O controller carrega o sampler,
habilita o botão após o carregamento, inicia o contexto de áudio após interação
do usuário e libera o sampler ao sair da página.

Essa demonstração ainda não converte entidades Ruby em eventos de áudio. Ela
usa uma nota fixa e não representa sequenciamento, duração musical, acordes,
escalas, seleção de instrumento ou exportação.

A decisão e os limites estão em [decisao-audio.md](decisao-audio.md).

## 4. Validação disponível

Existem testes de modelo para notas, intervalos, padrões, escalas e acordes,
além de testes de controller para a apresentação e a dashboard. A suíte Rails
foi executada em 13 de outubro de 2026 com:

```text
PARALLEL_WORKERS=1 mise exec -- bin/rails test
```

O comando terminou sem erro reportado. A documentação da decisão de áudio
registra uma execução anterior com 70 testes e 479 verificações. Essa suíte
Ruby não substitui a verificação manual no navegador, especialmente para
carregamento de assets, interação do piano e saída sonora.

## 5. Estado do Git e rastreabilidade

O levantamento foi realizado na branch `feature/music-domain-models`. O último
commit identificado foi `e663727 docs: actual domain modelation documentation`.

No momento do registro havia mudanças locais não commitadas relacionadas a:

- README, rotas, layout e importmap;
- apresentação, dashboard e controllers Stimulus;
- estilos, fontes, Tone.js e sample do Salamander;
- testes de controllers;
- documentação de domínio, áudio e página inicial.

Essas mudanças pertencem ao estado de trabalho em andamento. Este documento
não afirma que elas estejam prontas para integração ou commit; essa decisão
deve ocorrer após revisão conjunta do conjunto.

## 6. Limitações conhecidas

- Não há uma representação de composição com tempo, faixas e eventos.
- Tonalidades, campos harmônicos, graus e progressões ainda não foram modelados.
- Não existe integração entre o domínio musical e a reprodução no navegador.
- Os DevReports dependem de registros versionados junto às entregas; não são
  inferidos automaticamente do código ou dos commits.
- A reprodução usa um único sample e ainda requer avaliação auditiva pelo autor.
- O piano roll em `/componentes` é um protótipo sem persistência; ainda não há
  notação, mixer, efeitos ou exportação.
- Há uma primeira lição de notas; exercícios, outras lições e progresso ainda
  não foram implementados.
- Análise de áudio e transcrição permanecem experimentais e fora do núcleo atual.

## 7. Prioridade para a reta final

As próximas etapas devem ser escolhidas pelo valor demonstrável e pela
viabilidade no prazo restante. A sequência recomendada é:

1. consolidar um fluxo mínimo de composição estruturada;
2. conectar esse fluxo a uma reprodução verificável;
3. expor contexto musical suficiente para uma explicação educacional;
4. validar o fluxo completo pela interface;
5. registrar limitações e separar claramente extensões experimentais.

Novas funcionalidades de produção sonora, análise de áudio e notação devem
ser incluídas apenas se houver tempo e justificativa proporcional ao objetivo
acadêmico.

## 8. Forma de trabalho atualizada

Durante a reta final, o desenvolvimento será organizado em etapas maiores e
concluíveis. Cada etapa deverá começar com escopo, arquivos afetados,
verificação e riscos explícitos. Uma vez autorizada, poderá atravessar as
camadas necessárias sem aprovação a cada pequeno incremento.

Mudanças estruturais, novas dependências, alterações de arquitetura,
persistência ou expansão relevante do escopo continuam exigindo discussão
específica antes da execução.
