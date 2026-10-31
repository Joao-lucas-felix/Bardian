# Tema de estúdio e modernização da harmonia

Escopo solicitado: fundo mais preto, maior contraste nas páginas e aparência
moderna para composição de harmonias, com animações SVG.

Referências consultadas: interface do Ableton Live
(https://www.ableton.com/en/live/learn-live/interface/), organização do BandLab
(https://blog.bandlab.com/studio-faq/) e Soundtrap (https://www.soundtrap.com/musicmakers).
Aplicação: transporte agrupado, superfícies distintas, ações e seleção em verde.

## Implementação

- Tokens escuros globais em productivity.css: fundo #080b0d, superfícies #121719
  e #1b2326, texto #f3f7f5, texto secundário #b9c8c1 e acento #8ce3bd.
- Escuro como padrão; escolhas explícitas claras/escuras continuam disponíveis.
- Folha studio.css após as folhas existentes para componentes, editor e estados.
- Partial shared/sound_mark: SVG decorativo reutilizável. Na navegação reage ao
  foco/hover; no transporte anima apenas enquanto o áudio está em playing.
- Toolbar permanece fora do frame para não reinicializar o transporte.
- Nenhuma mudança no domínio musical, persistência, biblioteca ou dependência.
- Respeitar prefers-reduced-motion; animação não representa amplitude medida.

## Verificação

- [x] Testar tema padrão, preferência salva e armazenamento indisponível.
- [x] Testar estado da animação ao tocar, pausar, carregar, parar e falhar.
- [x] Implementar tema, SVG, barra de ferramentas e apresentação do editor.
- [x] Verificar contraste numericamente e executar testes Rails/JavaScript.
- [x] Registrar resultados e limites da inspeção visual no DevReport.

## Ajuste solicitado durante a execução

Mapa ampliado na largura útil, tavernas com telhado de madeira, bandeira musical,
caixas e barris. SVG original orientado pela nova referência enviada pelo usuário.
Movimento de bandeira e fumaça limitado a quatro segundos na chegada; desativado
por prefers-reduced-motion. Não foram publicadas aulas demonstrativas.

## Evidência e limites

163 testes JavaScript aprovados (Node com isolamento de processos desativado no
ambiente restrito). 177 testes Rails, 1166 asserções aprovadas antes dos registros
de entrega. Contraste calculado: texto principal/fundo 18,26:1; texto secundário/
painel 9,20:1; botão de ação 11,77:1. Estes pares não substituem auditoria visual
de todos os estados da aplicação. Chromium ausente e Firefox/Snap indisponível
no sandbox impedem confirmar screenshots desktop/mobile.

Responsabilidades: o novo partial só fornece SVG decorativo, a toolbar conserva
seus dados e ações existentes e o controller expõe apenas o estado do transporte.
