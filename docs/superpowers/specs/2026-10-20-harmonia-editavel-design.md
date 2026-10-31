# Harmonia editável e catálogo sonoro local

## Estado e intenção

Proposta técnica para revisão do autor. O escopo funcional foi autorizado em
20/10/2026; as decisões abaixo explicitam os efeitos sobre o contrato atual.
Este arquivo não registra uma funcionalidade entregue.

Preservar o visual aprovado e a prioridade do TCC: criar, ouvir, compreender e
modificar. A página principal deve mostrar poucos controles, com duração por
bloco, recomendações discretas e escolha de timbre. A visualização de notas
continua simples; “Editar composição” abre a edição expandida.

## Evidência no código atual

- `Music::HarmonyLane` exige tríades contíguas de 480 ticks e uma região.
- `harmony_draft.js` usa grupos de três notas e calcula posição pelo índice.
- `CompositionHarmony` valida pelo mesmo contrato restrito, inclusive no GET.
- `opendaw_mapping.js` e `CompositionHarmony#merge` aceitam apenas `synth`.
- `harmony_engine.js` instancia sempre Vaporisateur; os provedores de samples
  e SoundFonts estão explicitamente desabilitados.
- O SDK instalado oferece Vaporisateur, Neon, Tubular, Nano e Soundfont, entre
  outras fábricas. Existência de fábrica não significa banco de sons instalado
  nem timbre já validado no navegador.
- O editor avançado já possui piano roll, eventos de edição e expansão.
  Reutilizar sua edição, sem reutilizar implicitamente o transporte Tone.
- A página salva desabilita Turbo atualmente para estabelecer isolamento de
  áudio. Frames internos precisam de habilitação específica, não de remover
  indiscriminadamente essa proteção.

## 1. Duração e edição musical

Manter o JSON musical atual, com notas como fonte de verdade. Não criar uma
segunda lista persistida de acordes nem migrar automaticamente documentos.

Na forma guiada, um bloco contém três notas simultâneas de duração igual.
Permitir 240, 480, 960 e 1920 ticks (½, 1, 2 e 4 tempos). A região deve terminar
no fim da sequência; uma sequência vazia mantém a duração mínima atual.
Reordenar preserva IDs, alturas, intensidades e durações. Alterar duração
desloca os blocos seguintes pela diferença, sem mudar o andamento.
O limite continua sendo 32 blocos, não oito compassos.

O piano roll expandido edita a região da faixa de harmonia: criar, remover,
mover e redimensionar notas, com seleção e histórico existentes. Não é uma
segunda DAW multifaixas. O documento principal recebe cada edição confirmada;
fechar o painel não significa descartar nem salvar no servidor.

Separar validação de dados musicais da capacidade de usar o editor guiado:

1. Validar sempre identidade, autorização, notas, região, instrumento e versão.
2. Identificar se as notas ainda formam a sequência de tríades contíguas.
3. Se sim, reconstruir somente a projeção visual dos blocos.
4. Se não, preservar integralmente a edição e mostrar “Edição livre”.
5. Nesse estado, manter ouvir, editar e salvar; desabilitar operações que exigem
   blocos e explicar o motivo. Não quantizar, completar ou apagar notas.
6. Ao restaurar uma sequência compatível no editor, recuperar os controles
   guiados sem conversão destrutiva.

Uma tríade fora do campo tonal pode continuar sendo um bloco válido, sem cifra
ou função inventada. Reconhecimento generalizado de acordes, arpejos e voicings
fica fora desta etapa.

Alternativa descartada: armazenar blocos e notas separadamente. Isso preservaria
fronteiras de blocos durante qualquer edição, mas introduziria novo contrato,
sincronização e migração desnecessários antes de validar a necessidade.

## 2. Catálogo inicial

Proposta: quatro presets locais de síntese, apresentados honestamente como
“Sintetizador suave”, “Pad”, “Dedilhado sintético” e “Órgão sintético”.
Configurar o Vaporisateur já integrado com diferenças de envelope, forma de
onda e filtro. São quatro timbres, não quatro motores nem amostras acústicas.

Manter `synth` compatível com documentos existentes. Novos identificadores de
timbre devem ser estáveis e validados em uma lista permitida; o documento não
deve conter classes ou parâmetros internos do openDAW. O catálogo de
apresentação deve vir de uma definição única compartilhada com o adaptador,
evitando rótulos e opções divergentes no Rails e no JavaScript.

O seletor aparece na barra compacta. A troca marca a edição como não salva e
interrompe a execução antiga; o próximo play e a pré-escuta usam a escolha.
Instrumentos desconhecidos geram erro claro, nunca substituição silenciosa.
Verificar os consumidores legados para não quebrar a leitura dos novos IDs.

A disponibilidade final depende de teste de execução de cada preset e escuta
do autor. Não afirmar melhora perceptiva apenas porque os testes passam.

Alternativas: Tubular/Neon para síntese adicional; Nano/Soundfont para amostras.
Não adicionar bancos externos nesta primeira implementação. Se timbres
acústicos forem necessários, apresentar fonte, licença, tamanho e carregamento
local antes de incorporá-los; a autorização para ampliar o catálogo não
substitui essa decisão de dependência.

## 3. Interface e Hotwire

Preservar arco, tipografia e paleta existentes. Usar verde discreto com rótulo
“Sugerido”; seleção deve ter contorno próprio. Reutilizar as transições
didáticas do gerador no servidor, não duplicar teoria musical em JavaScript.
Essas recomendações são heurísticas do produto, não regras obrigatórias.

Shell ajustado à altura disponível com cabeçalho e transporte estáveis.
Área central alterna entre harmonia, ajustes e editor expandido. Não empilhar
todos os painéis. Timeline mantém rolagem horizontal; piano roll e painéis
podem rolar internamente. Em telas baixas e com zoom, preservar acesso por
teclado e conteúdo legível, sem ocultar controles para cumprir altura fixa.

Turbo Frames carregam os painéis autorizados do Rails; Stimulus gerencia
interações imediatas, foco e projeções do documento em memória. Não enviar uma
requisição por movimento de nota. O frame não é proprietário do documento nem
do AudioContext: ambos permanecem no controlador do shell, fora da substituição.
Um painel carregado deve receber o estado atual, não sobrescrever edições com
uma cópia antiga do servidor. Falhas de carregamento mantêm o trabalho local.

Preservar navegação completa na entrada da página isolada e os cabeçalhos
COOP/COEP. Habilitar Turbo apenas no escopo interno necessário.

## 4. Views e responsabilidades

- `harmony/show`: shell, dados iniciais, estado de salvamento e área dos frames.
- Barra de ferramentas: transporte, seletor de timbre e abertura dos painéis;
  recebe catálogo e estado do controller.
- `harmony/_lane`: blocos e controles contextuais de duração; recebe projeção,
  sem identificar acordes no ERB.
- `harmony/_chord_wheel`: opções e recomendações calculadas pelo domínio.
- `harmony/_piano_roll`: projeção de leitura compacta.
- Painel de edição: reutiliza o partial de piano roll existente e conecta seus
  eventos ao documento da harmonia, sem montar o transporte legado.

Controllers continuam responsáveis pela autorização e coordenação; domínio
valida a música e calcula compatibilidade/sugestões. Views não consultam banco
nem decidem autorização.

## 5. Verificação e limites

Testes Ruby via `mise exec --`: durações variadas, fronteiras da região,
preservação de outras faixas, documentos antigos, notas livres, instrumentos
permitidos, proprietário, conflitos de versão e frames autenticados.

Testes JavaScript: deslocamento por diferença de duração, reordenação,
conservação de IDs, sincronização do piano roll, desfazer/refazer, alternância
de painéis sem perda, mapeamento de timbres e cancelamento de áudio antigo.

Navegador: abrir, editar, ouvir, trocar instrumento, salvar e reabrir; verificar
desktop/mobile, teclado, zoom, rolagem interna e ausência de reinicialização do
motor ao trocar painéis. Build de áudio e teste de cada preset.

Não inclui mixer, efeitos, bancos acústicos, exportação nova, edição multifaixas
nem migração completa do editor legado. Registrar no DevReport somente os
comportamentos implementados e verificados, não esta proposta.
