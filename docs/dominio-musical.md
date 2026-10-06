# Convenções do domínio musical

Este documento registra as convenções implementadas em Note, Interval,
IntervalSpec, ScalePattern e Scale. As escolhas delimitam o escopo atual
e podem ser revistas explicitamente conforme as necessidades do projeto.

## 1. Responsabilidades

- Note representa uma altura musical por letra, acidente e oitava.
- Interval analisa a relação ordenada entre duas notas existentes.
- IntervalSpec descreve um intervalo que pode ser aplicado a uma nota.
- ScalePattern guarda uma sequência ordenada de intervalos relativos
  à mesma nota inicial.
- Scale associa uma nota inicial a um padrão e calcula suas notas.

Essas classes não representam duração, intensidade, posição temporal,
persistência ou reprodução. A separação permite reutilizar o domínio
na geração, edição e contextualização musical.

## 2. Grafia e altura

As letras aceitas são A, B, C, D, E, F e G.

A igualdade de notas considera letra, acidente e oitava. A operação
same_pitch? compara suas posições cromáticas.

Assim, C#4 e Db4 têm a mesma altura na representação adotada, mas não
são iguais por grafia. Preservar essa distinção permite analisar
intervalos e construir estruturas musicais sem perder sua escrita.

## 3. Referência cromática e oitavas

A posição cromática usa C0 como zero e 12 semitons por oitava.
A mudança de oitava escrita ocorre entre B e C.

O acidente altera a altura sem alterar a letra ou a oitava registrada:
B#4 tem a mesma posição cromática de C5.

A posição cromática não é um número MIDI nem uma frequência.
O domínio aceita oitavas inteiras, inclusive negativas, sem impor
limites de reprodução nesta etapa.

## 4. Acidentes e transposição

Note aceita acidentes inteiros de -2 a 2: bemol duplo, bemol,
natural, sustenido e sustenido duplo.

A transposição combina deslocamento diatônico e cromático para
determinar a letra, a oitava e o acidente do resultado.

Se o resultado exigir acidente fora desse limite, a operação levanta
ArgumentError. Não substitui automaticamente a grafia por outra de
mesma altura, pois isso mudaria a relação diatônica solicitada.

## 5. Intervalos e direção

O número do intervalo usa a contagem inclusiva das posições diatônicas.
Intervalos compostos são preservados: uma nona continua sendo nona.

A classificação considera a direção escrita, que pode diferir do
movimento de altura. De C##4 para Db4, por exemplo, há avanço de uma
posição diatônica e descida de um semitom.

IntervalSpec exige direção explícita. Para uníssonos, os passos
diatônicos são zero; a direção distingue o movimento cromático
dos uníssonos aumentados.

## 6. Qualidade e multiplicidade

Uníssono, quarta e quinta, incluindo seus compostos, pertencem à
família justa. Segunda, terça, sexta e sétima pertencem à família
maior/menor.

Interval classifica a qualidade e disponibiliza quality_offset,
o desvio em relação à referência maior ou justa.

IntervalSpec representa alterações múltiplas por multiplicity,
permitida acima de 1 apenas para aumentado e diminuto.
Uma descrição válida não garante aplicação a qualquer nota:
o resultado ainda precisa respeitar os acidentes aceitos por Note.

## 7. Convenção de uníssono

Quando não há deslocamento diatônico, Interval usa a distância
cromática absoluta para classificar a qualidade.

Por convenção do projeto, uníssonos alterados são classificados como
aumentados, inclusive no movimento descendente. IntervalSpec rejeita
uníssono diminuto. Essa restrição não se aplica à oitava diminuta.

## 8. Imutabilidade e entrada textual

As cinco classes são imutáveis após a construção.
Uma transposição produz uma nova Note.

ScalePattern copia e congela a lista recebida. Seus intervalos são
compartilhados porque IntervalSpec já é imutável.

Scale mantém referências à nota inicial e ao padrão, ambos imutáveis,
e congela a lista de notas calculadas.

Note.from_s exige letra maiúscula, acidente opcional em ASCII
(b, bb, # ou ##) e oitava inteira em formato canônico.
Não normaliza espaços, minúsculas ou símbolos musicais Unicode.

Essas restrições tornam a entrada previsível; uma futura interface
poderá discutir formas adicionais de entrada sem alterar silenciosamente
o contrato do domínio.

## 9. Padrões de escala

ScalePattern recebe um Array não vazio de objetos IntervalSpec
e preserva sua ordem.

Cada intervalo descreve uma posição em relação à mesma nota inicial,
não em relação à nota anterior. Essa escolha permite reutilizar
IntervalSpec e preservar a grafia musical nas transposições.

O construtor valida a estrutura da lista, mas não exige sete posições,
uníssono inicial ou direção ascendente. Também não identifica
automaticamente o nome musical de um padrão.

Existem dois padrões prontos:

| Posição | major | natural_minor |
|---|---|---|
| 1 | Uníssono justo | Uníssono justo |
| 2 | Segunda maior | Segunda maior |
| 3 | Terça maior | Terça menor |
| 4 | Quarta justa | Quarta justa |
| 5 | Quinta justa | Quinta justa |
| 6 | Sexta maior | Sexta menor |
| 7 | Sétima maior | Sétima menor |

ScalePattern.major e ScalePattern.natural_minor retornam novos padrões
imutáveis, com sete intervalos ascendentes e sem repetição da oitava.

O nome natural_minor distingue explicitamente a forma menor natural.
Não há métodos prontos para as formas menor harmônica e menor melódica
no escopo atual.

## 10. Construção de escalas

Scale recebe root, uma Note com oitava definida, e pattern,
um ScalePattern. As notas são calculadas durante a construção,
aplicando cada intervalo do padrão à mesma root.

O resultado preserva a ordem do padrão e a grafia determinada
pelos intervalos. Scale não ordena as notas nem acrescenta
automaticamente a repetição da nota inicial na oitava seguinte.

Exemplos dos padrões disponíveis:

- D4 com major: D4, E4, F#4, G4, A4, B4, C#5.
- A4 com natural_minor: A4, B4, C5, D5, E5, F5, G5.
- C4 com natural_minor: C4, D4, Eb4, F4, G4, Ab4, Bb4.

O cálculo no construtor garante que uma instância só seja criada
quando todas as notas puderem ser representadas.

Entradas de tipos inválidos ou transposições que exijam acidentes
fora de -2 a 2 levantam ArgumentError. Não há substituição automática
por grafias de mesma altura.

Por exemplo, D##4 com o padrão maior exigiria F triplo sustenido
na terceira posição, impedindo a construção dessa escala.

A representação atual descreve uma sequência de alturas com grafia
e oitava. Não define duração, ritmo, reprodução ou funções harmônicas.
