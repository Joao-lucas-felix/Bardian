# Composições e harmonia persistida

## Decisão de engenharia — 19/10/2026

O fluxo ativo é biblioteca → composição → harmonia. As interfaces anteriores não
possuem mais rotas públicas; seus arquivos foram preservados em `app/legacy/` e
`docs/legacy/`. Não houve migração destrutiva dos documentos existentes.

O JSON musical versão 1 continua sendo a fonte de verdade. `CompositionHarmony`
projeta uma faixa identificada por `harmony-<id da composição>`; ao salvar, mescla
essa faixa, andamento e contexto sem regravar as outras faixas nem o loop. Uma
música antiga recebe uma faixa guiada vazia, não uma inferência das notas antigas.
O GET não grava. PATCH exige `lock_version`; conflito não sobrescreve a música.

Capas usam Active Storage local: JPEG, PNG ou WebP, até 5 MB. A interface serve
capas por uma rota autenticada do proprietário. Busca e ordenação ficam no
controller; as views recebem registros autorizados e dados musicais prontos.

## Reprodução

`audio/opendaw_harmony.js` cria o AudioContext a partir de um gesto e importa o
bundle local. `opendaw_mapping.js` converte 480 ticks por semínima para o PPQN do
SDK e normaliza velocity. O adaptador cria regiões e notas através da API pública
de Project. Edições e novas escutas cancelam pedidos anteriores ainda pendentes.

O catálogo compartilhado em `config/harmony_instruments.json` oferece quatro
presets Vaporisateur e 11 timbres FluidR3: piano, dois pianos elétricos, violão,
duas guitarras, órgão, cordas, coral, pad e vibrafone. A indicação “lo-fi” sugere
instrumentos; não aplica efeitos. Os quatro IDs anteriores foram preservados.
O documento musical continua guardando apenas `instrument_id`.

O motor aguarda o banco e a prontidão dos recursos no worklet antes de tocar.
Banco/programa MIDI são resolvidos para o índice real do preset; os presets do
FluidR3 não estão ordenados por programa. A preparação é serializada e cancelada
por consumidor para impedir que uma intenção antiga inicie áudio após parar,
editar ou trocar o timbre. Não há fallback sonoro silencioso.

A página salva usa COOP `same-origin` e COEP `require-corp`, com navegação completa
(sem Turbo na entrada). Dentro dela, Turbo Frames substituem apenas os painéis;
documento, histórico e transporte permanecem no controller principal.
`AudioEngineHeaders` aplica COEP e CORP aos arquivos estáticos do SDK.
Se um proxy/CDN servir esses arquivos, deverá preservar essas políticas também.
Os binários são servidos de `/audio-engine/wasm`; a API recebe `/audio-engine`
como base, pois acrescenta `/wasm` internamente.
O middleware envia `no-cache` para o ponto de entrada e os binários WASM, cujos
nomes são estáveis. Assim, novas versões do SDK não reutilizam artefatos antigos
com nomes iguais. Se uma tentativa de preparar o motor falhar depois da carga
WASM, uma nova tentativa registra o processador no novo `AudioContext` antes de
criar o projeto; o conjunto compilado permanece compartilhado pela página.

## Dependências e distribuição

O lockfile fixa o grafo instalado: studio-sdk 0.0.174, studio-core 0.2.8 e
studio-core-wasm 0.0.19. Seus manifests declaram AGPL-3.0-or-later. Esta etapa
não publica o projeto nem escolhe uma licença para todo o Bardian. Antes de
distribuir ou disponibilizar o serviço, revisar as obrigações aplicáveis de
licença, avisos e oferta de código-fonte correspondente. Manter o lockfile e os
scripts de build disponíveis junto do código. Não tratar abrir o código somente
no futuro como uma dispensa das obrigações de distribuição atuais.

## Organização visual

Biblioteca em linhas, formulário com nome e capa, entrada com duas opções de
edição. Conforme o diagrama fornecido pelo autor em 19/10/2026, a harmonia usa
sete acordes em arco, timeline horizontal rolável e piano roll recolhido na base.
Não há código de cores por função. Configuração e sugestões estão recolhidas;
a seleção revela notas e função didática. Os partials separam
metadados, capa, linha de biblioteca, controles, opções, sequência e sugestões.
Consultas e regras de harmonia não foram transferidas para ERB. Na timeline,
arrasto por mouse, Antes/Depois e Alt+setas movem tríades inteiras. IDs, alturas,
velocity e duração são preservados; somente onsets mudam. A análise musical é
recalculada na nova ordem. No celular, o gesto horizontal rola e os botões movem.
O piano roll compacto continua somente de leitura. “Editar composição” abre o
editor existente sobre as mesmas notas, com desfazer/refazer. Alterações que deixam
de formar tríades contíguas entram em “Edição livre”: continuam salváveis e
reproduzíveis, sem forçar a conversão nem perder notas; operações guiadas
incompatíveis ficam indisponíveis. Recomendações usam cor discreta e o texto
“Sugerido”, com seleção visual distinta.

Cada bloco guiado aceita ½, 1, 2 ou 4 tempos (240, 480, 960 ou 1920 ticks).
Alterar duração ou ordem recalcula os inícios seguintes e o fim da região,
preservando IDs, alturas e intensidades. O gerador continua criando blocos de um
tempo e acrescenta-os no fim real da sequência.

## Limites desta entrega

- Harmonia guiada em 4/4, até 32 acordes com durações variáveis.
- Tom maior ou menor natural; mudar o contexto não transpõe notas existentes.
- Quatro presets sintéticos e 11 timbres FluidR3; sem efeitos, exportação ou mixer novo.
- Edição livre limitada à duração atual da região; não acrescenta compassos nesta etapa.
- O editor avançado ainda é a referência anterior, não a interface completa do openDAW.
- Bundle de áudio relativamente grande (cerca de 6,4 MB JS antes de gzip, além de WASM),
  carregado na primeira escuta. Otimização e avaliação perceptiva ficam para etapa própria.
- Build local validado; imagem Docker e implantação atrás de proxy não executadas nesta etapa.

## Verificação

Testes cobrem autorização, capas, versão concorrente, persistência e preservação
de outras faixas, projeção/mapeamento de ticks, cancelamento de áudio e estado
de salvamento durante edições. No navegador de teste: criar, adicionar C/G,
salvar, reabrir, inicializar o worklet e observar reprodução/parada; reordenar por
botão, arrasto e teclado, salvar a nova ordem e conferir as notas projetadas. Revisão
visual em desktop e celular, sem overflow horizontal nas páginas inspecionadas.
Essa verificação de execução não substitui avaliação auditiva humana do timbre.

### Incremento de 20/10/2026

Verificação final: 183 testes Rails, 1.421 assertions, sem falhas; 19 arquivos
de testes JavaScript aprovados; build Vite concluído. Foram cobertos duração,
histórico, catálogo, persistência livre, autorização e troca dos painéis. A revisão
dos partials manteve autorização no controller e regras musicais no domínio.
O Dockerfile passa a copiar o catálogo para o estágio de áudio; a imagem completa
não foi construída. Permanecem os avisos de build do SDK sobre `nam.wasm` e
anotações de Zod, sem erro na compilação.

No navegador, foram verificados duração, instrumento, edição, desfazer/refazer,
salvar/reabrir edição livre e reprodução. Nesta conferência final, órgão e synth
chegaram a “Tocando”; a página mediu exatamente a altura/largura da viewport em
1280×720 e 390×844, com rolagem interna no editor. A última tentativa de salvar
o timbre foi interrompida pelo encerramento do processo Rails (saída 143): a tela
preservou o rascunho e exibiu falha de conexão, sem confirmação de salvamento.
A revisão independente não executou por limite de uso; houve revisão local,
não revisão externa. Avaliação auditiva dos quatro presets permanece humana.

### Faixas, declaração e agulha — 21/10/2026

O documento mantém `harmony.blocks` separado das notas da faixa de realização;
uma segunda faixa gerenciada recebe notas adicionais e preserva seus tempos
absolutos. Os merges preservam todas as faixas externas. Blocos têm identidade
estável, contiguidade e limite de 32; editar duração, mover ou remover opera
sobre snapshots integrais para que desfazer restaure declaração e realização
juntas. A recuperação de documentos antigos é uma proposta explícita, nunca
um salvamento no GET. A interface expõe duas camadas e uma régua de posição
compartilhada.

O adaptador do openDAW separa preparação, reprodução, pausa, seek e pré-escuta.
Os testes de lifecycle usam promessas controladas para garantir que a intenção
mais recente vença; também validam ticks, corte no seek e isolamento do cursor
principal durante a prévia. A implementação exercitou o bundle local 0.0.174
no navegador: a página iniciou, atualizou o cursor e parou a reprodução. Isso
confirma a integração operacional, não a qualidade auditiva de rearticulação
para todos os timbres e navegadores; avaliação auditiva humana permanece
necessária.

Em 21/10, a verificação completa isolada passou com 155 testes Rails e 992
assertions, 136 testes JavaScript, `zeitwerk:check`, `git diff --check` e build
Vite de áudio. O build ainda emite avisos do SDK sobre `nam.wasm` resolvido em
runtime e comentários de Zod, sem falha de compilação. A revisão visual usou a
viewport local de 472×695, sem overflow da página; a matriz completa de
dispositivos/temas não foi repetida nesta etapa.

### FluidR3 distribuído pelo Bardian — 23/10/2026

`config/soundfonts.json` fixa origem Debian, versão 3.1, checksums do pacote e do
SF2, tamanho de 148.398.306 bytes, UUID e URL pública com hash. O banco original
possui 189 presets, incluindo variantes; a interface expõe somente a seleção
aprovada. A licença MIT e os créditos originais estão em
`docs/third-party/FluidR3-COPYING` e `FluidR3-README` e acompanham o asset.

Instalação local: `node bin/setup-soundfonts`. Para usar um pacote já baixado:
`node bin/setup-soundfonts --archive /caminho/fluid-soundfont_3.1.orig.tar.gz`.
O instalador valida ambos os hashes antes de renomear o arquivo temporário.
Requer Node, curl e tar. O binário é ignorado pelo Git. O Dockerfile usa estágio
próprio para instalá-lo e copiá-lo à imagem; não baixa no boot nem numa requisição.
Vite escreve em `public/audio-engine`, separado do banco. O middleware aplica
MIME binário e cache imutável de um ano apenas à resposta 200 da URL versionada;
um proxy que sirva o arquivo diretamente deve manter essa política.

O navegador baixa da própria aplicação somente na primeira escuta SoundFont.
O carregador implementa o contrato público `SoundfontLoaderManager`, usando
`SoundfontStorage` do SDK para OPFS. Isso permite propagar falhas de parsing que
o carregador padrão não comunica em todos os caminhos. Bytes são validados antes
do uso; cache inválido é removido apenas para este banco e baixado novamente.
Falhas HTTP, parsing, quota e tempo limite chegam à interface; tocar novamente
repete a tentativa. Durante download há percentual; durante parsing/preparação,
mensagem sem percentual. O banco interpretado é compartilhado na sessão.

OPFS requer suporte do navegador e contexto seguro. O navegador pode remover
seu cache; não há garantia de funcionamento offline. O arquivo completo ocupa
148 MB em disco e exige memória adicional para parsing e WASM. O parsing ainda
ocorre na thread principal e pode causar pausa: um timeout não interrompe código
síncrono. A distribuição integral permanece uma escolha de escopo aprovada,
com custo perceptível na primeira escuta e nas trocas de timbre.

Verificação automatizada: 19 testes Rails/203 assertions (incluindo DevReport) sem falhas, cinco
arquivos JavaScript aprovados e build Vite concluído. Cobertura inclui catálogo,
persistência, headers, cache corrompido, falhas/retry, cancelamento e resolução de
presets fora de ordem. A revisão corrigiu reuso de um SoundfontFileBox removido
do grafo e alinhou o prazo de espera ao carregamento real do worklet.
O ERB apenas apresenta nomes e a indicação lo-fi; catálogo e áudio permanecem
fora das views. Não houve alteração estrutural do layout.

Limitações da validação: Docker indisponível (daemon não acessível), portanto
imagem final, Thruster e proxy de produção não foram executados. Os avisos
anteriores de `nam.wasm` e Zod persistem no build. A matriz de dispositivos,
redes móveis, layout responsivo e avaliação auditiva humana não foi repetida.

#### Medidas locais de reprodução

Prova em Chromium 153, Linux x86_64, navegador integrado do Codex, servidor
localhost (sem simulação de rede; hardware físico não caracterizado). A prova
inicial sem cache levou 14,2 s até prontidão; após recarga com OPFS, 8,4 s. Esses
dois valores medem prontidão, não a primeira amostra sonora.

A conferência posterior com AnalyserNode e transporte real mediu 8,15 s de
preparação inicial usando cache e sinal após mais 20 ms. Todos os 11 timbres
produziram sinal. Trocas de timbre exigiram 2,09–3,35 s, seguidas de 16–17 ms
até a primeira amostra observada. Repetir a mesma composição com o mesmo timbre
exigiu menos de 1 ms de preparação e mais 17 ms até sinal. O cenário foi uma
tríade C4/E4/G4, velocity 75, volume 0,4, a 90 BPM, observada por 1,2 s.
Picos observados ficaram abaixo de 1 nesse cenário; a guitarra abafada teve
nível bastante menor. Isso não valida loudness nem ausência de clipping para
outras notas, volumes ou composições; não alteramos volumes salvos.

Heap JS ao fim: cerca de 321 MB, sem contabilizar toda a memória do motor.
Em prova separada do parser Node, RSS ficou em aproximadamente 514 MB. Não são
picos totais comparáveis nem garantias para celulares. Parsing, download e
transferência ao worklet não foram cronometrados individualmente. Avaliação
humana de equilíbrio entre instrumentos permanece necessária.

### Reutilização dos instrumentos — 24/10/2026

O banco FluidR3 interpretado continua compartilhado durante a sessão. O motor
agora conserva também a unidade openDAW de cada faixa enquanto o timbre da faixa
não muda: edições substituem apenas as regiões de notas e atualizam volume,
mute e solo. Na prévia de uma faixa, a segunda unidade permanece vazia e silenciada;
ao retornar à composição, ela pode ser reutilizada. O limite é de duas unidades,
correspondente às duas faixas mapeadas hoje. Trocar o timbre substitui somente a
unidade afetada; fechar a página libera o projeto inteiro.

Depois da escolha de um novo timbre em uma composição com notas, o transporte
prepara o grafo em segundo plano, sem tocar. Se o usuário pedir reprodução antes
de terminar, a mesma preparação é aguardada; uma intenção mais nova cancela a
anterior. A primeira preparação e o parsing do banco ainda podem demorar. A
reutilização reduz trabalho nas escutas seguintes, mas o tempo até a primeira
amostra sonora após esta mudança não foi medido em hardware real.

O painel de ajustes limita a composição visual a 780 px em telas largas, com
largura fluida em telas menores. A inspeção local encontrou 780 px em viewport
de 1280 px e nenhuma rolagem horizontal em 390 px. O cabeçalho permite quebra
de linha para manter o botão Salvar visível no celular. Views e partials não
receberam lógica nova: o cache continua no motor e a preparação no controller.
Na prova funcional do navegador, o piano entrou em reprodução após a seleção do
timbre e voltou a reproduzir depois de acrescentar outro acorde, sem erro no
console. O estado “Pausar” confirma o transporte iniciado, não mede a primeira
amostra sonora nem substitui uma avaliação auditiva.

### Ações das sugestões visíveis — 24/10/2026

Com quatro acordes gerados, o conteúdo do painel de ajustes ultrapassava a
altura disponível em uma janela de 1280 × 720 px. O contêiner ocultava a sobra:
os botões “Ouvir prévia” e “Adicionar sugestão” continuavam no DOM, mas ficavam
abaixo da área visível. O painel de ajustes agora rola verticalmente e mantém a
linha dessas ações visível no rodapé da área enquanto a prévia é apresentada.
Os demais painéis preservam suas regras de rolagem. No navegador local, a ação
“Adicionar sugestão” funcionou após gerar quatro acordes; em 390 × 844 px, os
botões permaneceram visíveis sem alargar a página.
