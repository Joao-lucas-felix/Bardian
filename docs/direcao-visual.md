# Direção visual do Bardian

Atualizado em: 14 de outubro de 2026.

## Objetivo

O Bardian reúne criação e aprendizagem musical para iniciantes. A interface deve
permitir que uma pessoa encontre rapidamente dois caminhos reais: aprender as
primeiras notas ou experimentar uma ideia no piano roll. A apresentação explica
a proposta; o painel administrativo registra o desenvolvimento do TCC.

## Decisão visual

A referência de produto é a clareza de navegação e a prontidão para criar
observadas no BandLab. O Bardian usa menos elementos típicos de uma DAW para
dar prioridade à orientação do iniciante. O visual do ateliê manuscrito deixa
de guiar as telas principais. A música aparece por meio do piano, do piano
roll e de representações simples de notas no tempo.

- Família tipográfica: Lato quando disponível, seguida por Segoe UI e Arial.
  Títulos usam peso alto, texto explicativo usa tamanho e entrelinha generosos.
- Cor de ação: vermelho terroso (`#b93830` no tema claro), com temas claro e
  escuro definidos pelas variáveis de `productivity.css`.
- Superfícies: fundo neutro, painéis brancos ou escuros, bordas discretas e
  sombra reservada a elementos de entrada destacados.
- Ícones: SVGs de traço uniforme para navegação e ações. O texto permanece
  visível; os ícones são decorativos e não substituem nomes acessíveis.
- Navegação: Início, Aprender, Criar e Sobre sempre disponíveis. Painel aparece
  apenas para administradores. A lição possui âncoras para seus blocos.
- Responsividade: links principais continuam visíveis em uma segunda linha no
  celular; teclado e grade musical preservam rolagem local.

## Limites do incremento

O piano roll ainda é um protótipo sem salvamento. A ilustração na página inicial
é identificada como exemplo. A revisão visual não altera as entidades musicais,
o formato dos eventos nem a tecnologia de áudio. A qualidade da reprodução
continua exigindo avaliação auditiva do autor em um dispositivo real.
