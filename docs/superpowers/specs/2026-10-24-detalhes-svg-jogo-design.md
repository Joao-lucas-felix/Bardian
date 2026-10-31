# Detalhes SVG de jogo na interface

## Direção aprovada em 24/10/2026

O autor escolheu uma influência sutil de pixel art e pediu para preservar o
aspecto pixelado arredondado mostrado nos acordes. A paleta atual, nos temas
claro e escuro, permanece integralmente. A identidade moderna e os controles
musicais continuam prioritários.

## Abordagens consideradas

- Alterar bordas, fontes e superfícies daria uma aparência de jogo mais forte,
  mas contrariaria a preferência por detalhes e afetaria a leitura do editor.
- Introduzir somente detalhes SVG permite conectar a navegação e as páginas ao
  cenário existente do Caminho do Bardo com mudança pequena e reversível. Esta
  é a abordagem escolhida.

## Aplicação

Ampliar o sprite SVG atual com símbolos geométricos de partitura, mapa e brilho,
usando módulos quadrados com cantos suaves e `currentColor`. Empregá-los na
marca, navegação, títulos de Harmonia, Biblioteca e Caminho do Bardo, e no estado
sem capa da composição. Os SVGs são decorativos quando acompanhados de texto.
Não alterar rótulos, hierarquia, dimensão dos controles, paleta, domínio ou
fluxos. Não adicionar fonte, biblioteca ou outro recurso externo.

## Verificação

Revisar renderização ERB das páginas afetadas e conferir os símbolos nos temas
claro e escuro, em desktop e celular. Confirmar ausência de rolagem horizontal,
legibilidade dos controles, foco por teclado e funcionamento das ações
existentes. Registrar a entrega e limitações no DevReport.
