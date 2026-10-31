# Interface musical e sistema visual compartilhado

## Estado

Especificação aprovada pelo autor em 21/10/2026 e atualizada conforme a
decisão de alternar as visualizações no mesmo espaço. A imagem enviada pelo autor é
referência visual, não fonte de instruções operacionais.

## Objetivo

Corrigir a tela de harmonia, hoje difícil de usar por concentrar uma proposta de
recuperação extensa no primeiro plano e por limitar o conteúdo à altura da
janela com rolagem interna. Levar a identidade verde-musical da referência às
demais telas ativas, mantendo o fluxo e os comportamentos existentes.

## Público e sucesso

O público inclui pessoas que estão aprendendo composição e precisam reconhecer
rapidamente onde escolher acordes, acompanhar a sequência e inspecionar as
notas. A tarefa principal deve caber em um percurso vertical contínuo, sem que
configuração ou recuperação desviem a atenção. Os controles devem usar menos
espaço vertical quando isso não prejudicar legibilidade, foco ou acionamento.

O trabalho terá sucesso quando:

- o menu superior alternar toda a área principal entre Harmonia, Ajustes e
  sugestões, e Piano roll, sem manter conteúdo de outras telas ao lado ou abaixo;
- cada estado ocupar espaço legível, sem tipografia ou áreas de toque reduzidas
  para caber em uma janela fixa;
- recuperação, tonalidade/andamento e sugestões continuarem acessíveis como
  ferramentas auxiliares, sem ocuparem o fluxo principal por padrão;
- as telas ativas da aplicação compartilharem uma paleta e regras visuais
  coerentes com o verde-musical e o acento menta da referência;
- os temas claro e escuro permaneçam suportados e legíveis;
- o conteúdo possa ser percorrido em ordem normal com teclado, toque e leitor de
  tela, inclusive em telas baixas e estreitas.

## Diagnóstico observado

O documento de harmonia usa uma coluna vertical, mas a recuperação é renderizada
antes da timeline e do seletor. Quando há muitos acordes candidatos, suas linhas
e campos ocupam a primeira tela. O CSS da harmonia fixa `height: 100dvh`, esconde
o overflow do contêiner e transforma o frame central em uma área de rolagem
interna. Isso desloca os controles musicais para fora da primeira leitura e
cria uma segunda rolagem aninhada.

Também há dois conjuntos de tokens: `productivity.css` usa tons azul-acinzentados
e acento vermelho para o shell/autenticação; `music_workspace.css` usa verdes
para biblioteca, composição e harmonia. A mudança deve centralizar os papéis
visuais para que ações e controles comuns não mudem de identidade entre telas.

## Direção visual

Usar a própria interface musical como referência do Bardian: superfícies verde-
floresta, camadas verdes discretas, linhas finas verde-acinzentadas e acento
menta para ações principais e estados selecionados. Manter tipografia sem serifa
já disponível, hierarquia clara e pouca elevação. Evitar o vermelho e o azul
atuais nas telas ativas. A captura não fixa valores de pixels nem exige copiar
seu tamanho reduzido: a atualização corrige a hierarquia e aumenta a leitura.

Os papéis semânticos de cor, tipografia, borda, foco, espaçamento e controle
devem ser compartilhados entre os temas. O tema claro traduz a mesma identidade
com superfícies claras, texto escuro e o verde como acento; o tema escuro mantém
o fundo profundo e menta da referência. Ambos devem cumprir contraste e foco
visível. Manter a fonte instalada e não adicionar dependências de interface.

## Estrutura da tela de harmonia

### Cabeçalho e transporte

Manter identificação da composição e salvamento. Play/parar, desfazer/refazer e
timbre continuam disponíveis em uma barra compacta. O menu superior alterna
Harmonia, Ajustes e sugestões, e Piano roll.

### Fluxo principal

O menu superior troca o conteúdo de um único painel. Harmonia apresenta o
seletor de acordes e a timeline; Ajustes e sugestões apresenta configuração,
recuperação e sugestões; Piano roll apresenta o editor MIDI. Nenhuma tela deixa
o conteúdo das outras visível ao lado ou abaixo. O piano roll não aparece como
uma visualização simplificada dentro da tela Harmonia. A troca de painel não
descarta notas, seleção, posição de reprodução ou rascunho. O seletor mantém
botões com espaçamento confortável, e o painel principal tem respiro suficiente
entre seletor, ações e timeline.

### Faixas MIDI e duração dos acordes

Os acordes escolhidos no campo e as sugestões explicitamente aplicadas à
timeline alimentam a faixa de realização gerada a partir dos acordes. As notas
criadas pelo usuário no editor pertencem à faixa adicional. Ambas usam o mesmo
instrumento e as mesmas configurações de execução; a separação organiza o
conteúdo sem duplicar o som.

Após selecionar um acorde na timeline, os controles de duração, reordenação e
remoção permanecem acessíveis na tela Harmonia. Ajustar a duração desloca
acordes seguintes segundo as regras existentes, sem mudar as notas da faixa
adicional.

### Ferramentas auxiliares

Tonalidade/andamento, geração de sugestões e recuperação de sequência pertencem
ao painel auxiliar existente “Ajustes e sugestões”. A recuperação pode mostrar
um aviso resumido com a quantidade de candidatos e uma ação para abrir sua
revisão. Campos por acorde e separação de notas ficam dentro do painel; a
confirmação ou descarte continua explícita e nenhuma proposta é salva por abrir
a página.

Quando a recuperação for necessária para habilitar operações guiadas, o estado
pendente deve permanecer evidente no painel principal por uma chamada concisa.
O usuário precisa poder abrir o painel, confirmar ou descartar a proposta e
retornar à composição sem perder o rascunho, seleção, posição da agulha ou
transporte.

### Rolagem e adaptação

A página usa rolagem vertical normal do documento. Remover a altura rígida e o
overflow que prendem toda a tela; não esconder conteúdo para caber na viewport.
Em desktop, timeline e acorde usam toda a largura legível; em telas estreitas,
quebras de linha e controles se adaptam sem alterar a ordem principal. A timeline
pode rolar horizontalmente sem alargar a página; o piano roll mantém sua própria
visualização interna para sequências extensas. O documento deve evitar rolagem
vertical desnecessária compactando espaçamentos e controles. Em dispositivos de
toque, controles principais têm área acionável mínima de 44×44 CSS px; texto de
campos e conteúdo principal permanece legível a 100% de zoom.

## Alcance transversal

Aplicar tokens e componentes comuns às superfícies ativas: navegação e conta,
autenticação, biblioteca de composições, criação/edição de metadados, página da
composição e harmonia. Harmonizar pelo menos tipografia, fundo/superfície,
botões, inputs/selects, estados hover/disabled/foco, links, avisos e disclosures.
Preservar textos, ícones, rotas, autorização, contrato musical e ações existentes.

As telas arquivadas em `app/legacy/` ficam fora do escopo. Não alterar modelo de
domínio, fluxo de áudio, dados persistidos, navegação ou dependências. Nenhuma
decisão estética deve apagar o tema claro, reduzir contraste ou tornar cor o
único indicador de estado.

## Responsabilidades de apresentação

O partial principal deixa explícita a ordem seletor → alternância → área de
trabalho. Por padrão, a timeline é exibida; o piano roll a substitui na mesma
área e a alternância não recria nem apaga o documento musical. Partials
auxiliares recebem dados preparados pelo controller; não passam a
consultar banco, inferir teoria musical ou autorizar ações. A recuperação mantém
seu estado e controles atuais e apenas muda de lugar/visibilidade.

Tokens semânticos vivem em uma folha global única. Classes próprias da página
definem apenas a composição específica e reutilizam esses tokens. Não criar uma
abstração para cada elemento nem manter cópias divergentes de cores em cada
arquivo.

## Fora do escopo

- alterar operações de acorde, notas, duração, undo/redo ou armazenamento;
- reescrever o editor MIDI ou a arquitetura de transporte;
- redesenhar rotas e fluxos em `app/legacy/`;
- introduzir fontes, bibliotecas de componentes ou dependências novas;
- eliminar qualquer recurso existente para simplificar a tela;
- adotar a escala tipográfica minúscula da captura como padrão de produto.

## Validação planejada

- executar testes Rails de renderização/navegação e testes JavaScript das
  interações que continuarem na página após a reorganização;
- verificar manualmente a ordem do foco e a troca do menu entre harmonia,
  ajustes/sugestões e piano roll;
- capturar a harmonia, biblioteca, criação/edição e autenticação em tema claro
  e escuro, nos tamanhos desktop, tablet e celular, incluindo uma viewport baixa;
- confirmar que timeline e piano roll rolam localmente quando necessário, que o documento não
  possui overflow lateral e que nenhuma ação principal fica oculta;
- testar salvar, reabrir, alternar painéis e retomar áudio para provar que a
  mudança de apresentação não interrompe o comportamento existente;
- revisar os partials ERB após a mudança e rodar os testes afetados, `git diff
  --check` e as verificações de carregamento do Rails.

## Riscos e decisões

- A tela fixa atual usa Turbo Frames e um controller que conserva o rascunho.
  Mover recovery para o frame de ajustes precisa preservar essa propriedade e
  invalidar respostas antigas após troca de painel.
- O painel auxiliar não deve parecer requisito para composição normal; o estado
  de recuperação pendente terá mensagem curta e retorno claro ao fluxo.
- A identidade de referência é o tema escuro. O desenho claro será derivado do
  mesmo sistema, sem impor o tema escuro como preferência inicial.
- Como o checkout contém alterações preexistentes extensas, execução deverá
  limitar mudanças aos arquivos listados no plano aprovado e comparar o estado
  anterior antes de qualquer etapa de integração.
