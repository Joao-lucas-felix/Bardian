# Plano de evolução do Bardian

> Documento de trabalho para decidir onde o projeto precisa chegar, em que ordem e com quais critérios de conclusão.

Atualizado em: 15 de outubro de 2026.

## 1. Direção do projeto

O Bardian deve evoluir de uma coleção de protótipos musicais para uma
plataforma mínima de criação e aprendizagem musical assistida.

O fluxo principal que precisamos tornar demonstrável é:

```text
criar ou editar uma ideia musical
        ↓
visualizar sua estrutura
        ↓
ouvir o resultado
        ↓
compreender as relações musicais
        ↓
modificar a composição
        ↓
ouvir novamente
```

A representação musical estruturada deve ser a base comum desse fluxo. A
interface, o módulo educacional, o gerador e a reprodução devem consumir essa
representação, evitando que cada parte do sistema crie sua própria definição
de nota, acorde ou composição.

## 2. Resultado mínimo esperado para o TCC

Ao final da próxima etapa de desenvolvimento, uma pessoa sem conhecimento
avançado de teoria musical deve conseguir:

1. abrir uma composição inicial;
2. visualizar notas, acordes e sua organização temporal;
3. editar pelo menos uma camada musical;
4. reproduzir o resultado;
5. selecionar um elemento e receber uma explicação contextual;
6. alterar a composição e ouvir a diferença;
7. compreender quais partes ainda são protótipos ou limitações do sistema.

Esse resultado é mais importante do que implementar muitos recursos isolados.
Mixer, efeitos, análise de áudio e notação convencional só devem entrar no
núcleo se não ameaçarem esse fluxo.

## 3. Estado atual resumido

Já existem:

- domínio para notas, intervalos, especificações de intervalos, escalas e
  acordes;
- autenticação com usuários comuns e administradores;
- dashboard protegida com catálogo de DevReports;
- navegação de aprendizagem, apresentação e criação;
- primeira lição sobre notas, piano e piano roll;
- piano roll em Canvas com edição temporária e reprodução;
- composição organizada em harmonia, baixo, melodia e bateria;
- prévias em Canvas e instrumentos locais de piano, cordas e bateria;
- testes Rails e JavaScript para as principais funcionalidades atuais.

Ainda faltam as conexões que transformam esses protótipos em um fluxo de
composição coerente:

- uma representação de composição com tempo, eventos, faixas e contexto;
- uma ligação estável entre domínio musical, editor e reprodução;
- tonalidades, graus, campo harmônico e progressões;
- contextualização educacional baseada no estado real da composição;
- persistência ou um formato de exportação mínimo, caso isso seja necessário
  para demonstrar a continuidade do trabalho.

## 4. Prioridades

### Núcleo obrigatório

- composição musical estruturada;
- edição de notas, acordes e camadas;
- organização temporal;
- reprodução a partir da representação estruturada;
- contextualização educacional;
- renderização ou exportação mínima que possa ser validada.

### Extensões secundárias

- controle de volume por faixa;
- instrumentos adicionais;
- mixer;
- efeitos;
- visualizações avançadas;
- notação musical, se houver tempo e uma biblioteca adequada.

### Estudos experimentais

- análise de BPM, tonalidade ou acordes a partir de áudio;
- transcrição de áudio;
- reconhecimento de partitura por imagem;
- sugestões musicais avançadas ou geração automática mais complexa.

Experimentos devem permanecer identificados como experimentos. Um protótipo
experimental não deve ser tratado como requisito concluído sem avaliação de
qualidade, custo e utilidade.

## 5. Fases propostas

### Fase 0 — Fechar o recorte do produto

**Objetivo:** escolher o fluxo mínimo que será demonstrado e documentado no
TCC.

**Entregável:** uma descrição curta do cenário principal, por exemplo:
“criar uma progressão simples, visualizar suas camadas, editar uma melodia,
ouvir e entender o papel dos acordes”.

**Decisões necessárias:**

- o usuário poderá começar por uma composição vazia, por um exemplo pronto ou
  pelos dois caminhos;
- a primeira versão precisará salvar a composição ou poderá funcionar somente
  durante a sessão;
- a demonstração usará apenas uma tonalidade inicial ou permitirá várias;
- renderização para arquivo será requisito do núcleo ou apenas reprodução no
  navegador será suficiente.

**Critério de conclusão:** o cenário escolhido possui entradas, fluxo, saída,
limitações e relação explícita com o objetivo acadêmico.

### Fase 1 — Consolidar a composição estruturada

**Objetivo:** criar uma representação independente da interface e da
tecnologia de áudio.

**Conceitos mínimos:**

- composição;
- duração ou posição temporal;
- evento de nota;
- acorde ou conjunto harmônico;
- faixa;
- andamento;
- contexto tonal, quando a decisão da Fase 0 exigir.

**Responsabilidade:** o domínio deve representar o que acontece musicalmente,
sem conhecer Canvas, Stimulus, Tone.js, banco de dados ou HTML.

**Pontos a decidir antes do código:**

- unidade temporal: ticks, batidas, segundos ou outra abstração;
- se notas e acordes serão eventos distintos ou uma forma comum de evento;
- como uma faixa identifica seu instrumento e sua função;
- como a composição será copiada, validada e transformada;
- se a representação será inicialmente apenas Ruby, apenas JavaScript ou terá
  uma forma compartilhada/documentada entre as duas camadas.

**Verificações:** testes de criação, ordenação temporal, cópia, limites de
duração, faixas vazias e composição com múltiplas camadas.

**Critério de conclusão:** é possível construir uma composição em memória sem
usar controllers, views ou APIs de áudio.

### Fase 2 — Ligar o editor à composição

**Objetivo:** fazer o piano roll e os editores de frases operarem sobre a
representação estruturada, em vez de manter estados musicais independentes.

**Entregável:** editar uma nota no editor atualiza a composição e a prévia da
camada correspondente; selecionar uma camada não altera as demais.

**Verificações:** criar, mover, redimensionar e excluir notas; preservar
intervalos em movimentos de grupo; trocar a camada ativa; restaurar uma
composição inicial; impedir valores temporais inválidos.

**Limitação aceitável:** a composição pode continuar somente em memória nesta
fase, desde que o formato e o ciclo de vida estejam documentados.

**Critério de conclusão:** o editor é uma visão editável da composição, não a
fonte exclusiva dos dados musicais.

### Fase 3 — Reproduzir a representação musical

**Objetivo:** transformar eventos da composição em eventos reproduzíveis,
mantendo a separação entre domínio e áudio.

**Fluxo esperado:**

```text
Composição
    ↓
adaptador de eventos musicais
    ↓
Tone.js ou outra camada de reprodução escolhida
    ↓
som
```

**Pontos a decidir:**

- quais informações o adaptador recebe;
- como andamento, duração, pausa e sobreposição são convertidos;
- como iniciar, pausar, retomar e interromper;
- como reproduzir uma faixa isolada;
- como lidar com instrumento indisponível ou sample ainda carregando.

**Verificações:** reprodução da composição completa, reprodução isolada,
alteração seguida de nova reprodução, parada imediata e composição vazia.

**Critério de conclusão:** a reprodução usa a composição como entrada e não
uma sequência fixa duplicada no controller.

### Fase 4 — Completar o contexto musical

**Objetivo:** acrescentar as estruturas necessárias para explicar a música no
contexto em que ela está sendo criada.

**Ordem conceitual sugerida:**

```text
notas e intervalos
        ↓
escalas
        ↓
tonalidade
        ↓
graus e campo harmônico
        ↓
acordes dentro da tonalidade
        ↓
progressão harmônica
```

**Entregável mínimo:** dado um contexto tonal e uma sequência de acordes, o
sistema consegue identificar notas, graus e relações básicas para exibição.

**Decisões necessárias:**

- como representar tonalidade maior e menor;
- como lidar com acordes fora do campo harmônico;
- se a análise será explícita, inferida ou ambas;
- como representar o grau de um acorde com inversões ou extensões futuras;
- quais convenções serão apenas do projeto e quais serão justificadas por
  literatura ou documentação musical.

**Critério de conclusão:** o editor e a aprendizagem consultam as mesmas
regras de domínio para explicar um acorde ou uma progressão.

### Fase 5 — Transformar contexto em aprendizagem

**Objetivo:** permitir que a pessoa compreenda a composição enquanto a cria.

**Primeiro conjunto de explicações:**

- nota: nome, altura e posição temporal;
- intervalo: relação entre duas notas;
- acorde: notas que o formam;
- escala: conjunto e padrão intervalar;
- grau: posição dentro da tonalidade;
- progressão: ordem dos acordes e relações entre eles.

**Interface mínima:** selecionar uma nota, acorde ou trecho mostra uma
explicação curta, os elementos envolvidos e uma indicação de como isso pode
ser alterado.

**Critério de conclusão:** a explicação é produzida a partir da composição e
do domínio, sem regras musicais duplicadas nos partials ou controllers.

### Fase 6 — Validar o fluxo demonstrável

**Objetivo:** verificar a experiência completa como produto e como evidência
do TCC.

**Roteiro de validação:**

1. entrar na aplicação;
2. abrir a criação;
3. escolher ou receber uma composição inicial;
4. selecionar uma camada;
5. editar uma nota ou acorde;
6. ouvir a alteração;
7. selecionar um elemento;
8. ler a contextualização;
9. repetir a alteração e a reprodução;
10. registrar o resultado e as limitações observadas.

**Verificações:** testes automatizados, revisão de responsabilidades das views,
renderização das rotas, acessibilidade básica, comportamento responsivo e
avaliação manual de áudio.

**Critério de conclusão:** o fluxo é reproduzível por outra pessoa e suas
limitações estão documentadas.

## 6. Backlog após o núcleo

Somente depois das Fases 1 a 6 devem ser priorizados:

1. persistência de composições;
2. exportação MIDI ou áudio;
3. reprodução simultânea refinada das faixas;
4. volume e seleção de instrumento por faixa;
5. notação musical;
6. exercícios e progresso da aprendizagem;
7. sugestões musicais;
8. análise de áudio.

Cada item deve virar uma etapa própria, com objetivo, arquivos afetados,
decisões, testes, limitações e registro em `config/dev_reports.yml`.

## 7. Decisões que não devem ser tomadas silenciosamente

Antes de implementar mudanças estruturais, registrar uma decisão sobre:

- unidade e modelo de tempo;
- formato da composição;
- fronteira entre Ruby e JavaScript;
- persistência;
- protocolo de reprodução;
- instrumentos e fontes sonoras;
- formato de renderização ou exportação;
- escopo de tonalidades, graus e progressões;
- inclusão ou exclusão de uma funcionalidade experimental.

Para cada decisão, registrar alternativas consideradas, motivo da escolha,
impacto acadêmico, riscos e forma de revisão futura.

## 8. Critérios gerais de conclusão

Uma fase só deve ser considerada concluída quando:

- o comportamento esperado está definido;
- a implementação respeita a separação de responsabilidades;
- os casos principais foram testados;
- a interface foi verificada quando aplicável;
- as limitações conhecidas estão registradas;
- não há decisão estrutural implícita;
- o DevReport correspondente foi atualizado;
- o fluxo pode ser explicado e demonstrado pelo autor do projeto.

## 9. Próximo passo recomendado

Começar pela Fase 0 e produzir uma decisão curta sobre o fluxo que será usado
como demonstração principal. Em seguida, transformar essa decisão em uma
especificação da Fase 1, especialmente para resolver a unidade temporal e a
forma mínima de `Composition`, `Track` e `NoteEvent`.

Não iniciar a implementação da persistência, do mixer ou da análise de áudio
antes de validar essa base. Essas funcionalidades podem ser úteis depois, mas
não resolvem o principal risco atual: os protótipos ainda não compartilham uma
representação musical completa.
