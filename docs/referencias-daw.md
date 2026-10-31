# Referências de DAW e prova openDAW

**Estado:** prova técnica parcial; adoção do SDK ainda não aprovada
**Data da execução:** 18 de outubro de 2026

## Objetivo da investigação

Reaproveitar infraestrutura comum de DAW para que o Bardian concentre o esforço
na composição assistida e na aprendizagem. A pesquisa não equivale a decidir
recriar a interface de uma DAW profissional: timeline, piano roll e assistência
existentes continuam sendo produto do Bardian.

## Candidato avaliado

O pacote `@opendaw/studio-sdk` 0.0.174 é publicado sob AGPL-3.0-or-later e se
descreve como instalador do toolchain. Ele agrega pacotes de modelo de projeto,
adaptação, engine e WASM; portanto, não é apenas uma biblioteca pequena de
síntese. O `studio-core` contém o modelo headless de projeto e o `studio-core-wasm`
fornece engine, AudioWorklet, worker e módulos `.wasm` pré-compilados. A
distribuição publicada não exigiu compilação local de Rust durante esta prova.

## Resultado parcial da execução

| Verificação | Evidência | Resultado |
|---|---|---|
| Instalação isolada | `npm install @opendaw/studio-sdk@0.0.174` em `/tmp`; 70 pacotes adicionados | Passou |
| Engine no navegador | Exemplo headless em Vite; engine ativo identificado como WASM (Rust) | Passou |
| Isolamento | Log do exemplo: `crossOriginIsolated: true`; `SharedArrayBuffer` disponível | Passou no Vite, ainda não no Rails |
| Sessão de duas faixas | Protótipo temporário construído a partir da fixture de `test/models/music/composition_test.rb` | Inicialização e playback observados |
| Ticks | Bardian usa 480 ticks por semínima; SDK usa 960 PPQN; fator 2 preserva as posições e durações deste caso | Passou para a fixture |
| Andamento e loop | BPM 96; loop de teste 480–2400 ticks convertido para 960–4800 | Passou no protótipo |
| Volume | Conversão de amplitude linear `0..1` para dB; 0,8 ≈ −1,94 dB e 1,0 = 0 dB | Mapeamento demonstrado |
| Instrumentos | IDs piano e strings apontaram temporariamente para Vaporisateur | Não prova equivalência sonora |
| Mute/solo | Não foram incluídos no protótipo | Pendente |
| Ambiente Rails via mise | Ruby 4.0.7, Bundler 4.0.20 e Rails 8.1.4; `bundle check` passou | Ambiente disponível |
| Testes Rails focados | 30 testes, 208 asserções, zero falhas/erros/skips | Passou |
| Página Rails local | Home respondeu HTTP 200; página de composições redireciona para autenticação | Passou, sem prova de áudio |
| Assets locais pelo Rails | Build mínima montada temporariamente em `public/opendaw-proof`; ActionDispatch::Static serviu HTML, módulos, workers, worklets e WASM | Passou na prova descartável |
| Engine no navegador via Rails | Chrome local iniciou e mostrou `WASM (Rust)` / `Ready` | Passou para inicialização; playback de composição Bardian ainda pendente |
| Isolamento na rota de prova | Middleware Rack temporário aplicou COOP/COEP apenas a `/opendaw-proof/*`; navegador mostrou `crossOriginIsolated: true` e `SharedArrayBuffer: true` | Passou |
| Impacto das políticas na home Rails | Home respondeu HTTP 200 sem COOP/COEP; não foi alterada | Passou no escopo testado |
| Tamanho da build mínima | 8,1 MB em `/tmp`; Vite transformou 1.207 módulos e emitiu todos os plugins WASM do pacote | Medido; build ainda não otimizada para Bardian |
| Requisições de runtime | Scripts, worklets e WASM foram buscados no mesmo host; logo da demo fez GET local com 404 | Sem CDN de runtime no percurso exercitado; logo cosmético ausente |
| Dados persistidos disponíveis | 2 composições; cada uma tem 1 faixa, BPM 120, sem loop, flags mute/solo falsas | Nenhuma atende ao caso real de duas faixas exigido pelo gate |
| Paridade do modelo com fixture | BPM, conversão de ticks, notas, região, ganho, mute, solo e loop lidos de volta do projeto openDAW | 20/20 checks passaram |
| Playback e sinal | Engine em playback; tap de saída mediu RMS 0,09205 enquanto havia notas ativas | Sinal presente na fixture sintética; não é avaliação de timbre de instrumento real |
| Wrap do loop | Leituras sucessivas do playhead SDK cruzaram de ~4637 para ~1260 PPQN com loop configurado 960–4800 | Wrap observado no browser |
| Estado do banco após prova | Contagem consultada novamente no Rails via mise | Continua em 2; nenhuma composição foi gravada |

O protótipo e os `node_modules` estão em `/tmp`, não no diretório do Bardian.
O build completo de referência Vite foi concluído anteriormente com 146 MB por
incluir dezenas de demos e arquivos públicos. Para esta prova, uma configuração
Vite temporária substituiu as entradas por `wasm-engine-demo.html` e desativou
a cópia do diretório público; o resultado ficou em 8,1 MB. Ainda houve avisos
de comentários PURE e chunks JS maiores que 500 kB; o pacote pede todos os
plugins WASM, embora a demo use Vaporisateur. Portanto, 8,1 MB mede esta prova,
não uma integração otimizada nem o artefato final do Bardian.

Os arquivos foram montados temporariamente por symlink em `public/opendaw-proof`
e servidos pelo middleware estático normal do Rails, sob Rack/Puma. Um wrapper
Rack descartável adicionou `Cross-Origin-Opener-Policy: same-origin` e
`Cross-Origin-Embedder-Policy: require-corp` somente à rota de prova. O navegador
mostrou `crossOriginIsolated: true`, `SharedArrayBuffer: true` e inicialização
do engine WASM até o estado `Ready`. A home Rails continuou em HTTP 200 sem esses
cabeçalhos. A symlink foi removida e nenhum arquivo de runtime/dependência foi
adicionado ao projeto.

## Verificação de campos e playback

Uma leitura somente de agregados mostrou que as duas composições existentes no
banco local têm uma faixa cada, BPM 120, não possuem `loop` e mantêm mute/solo
desligados. O banco não oferece uma composição persistida adequada à comparação
exigida; ele permaneceu inalterado (contagem antes/depois: 2).

Para avançar sem falsificar esse requisito, o spike usou uma fixture sintética
derivada de `composition_data` em `test/models/music/composition_test.rb`:
duas faixas, BPM 96, notas de 480 e 960 ticks, volume 0,8/1, flags mute/solo
variadas e loop 480–2400. Valores foram lidos de volta do modelo openDAW. Os 20
checks cobriram BPM, limites e ativação do loop, duas faixas, posição/duração de
região, posição/duração/altura/velocity de cada nota, ganho, mute e solo. A
velocity é armazenada como `float32` pelo SDK; a comparação usa tolerância de
1e-5 para esse campo. O ganho 0,8 foi convertido para cerca de −1,94 dB; ticks
480 do Bardian correspondem a 960 PPQN openDAW.

O playback dessa fixture iniciou no Chrome e uma conexão de análise de saída
mediu RMS 0,09205 enquanto havia evento ativo. Durante reprodução contínua, o
playhead cruzou o final do loop de 4800 PPQN e voltou ao intervalo iniciado em
960 PPQN (amostras próximas de 4637 → 1260). O piano da fixture foi marcado
mute e a faixa de cordas solo; ambos os estados foram lidos de volta do
`AudioUnitBox`. Os dois IDs de instrumento ainda usaram Vaporisateur, então a
verificação não prova timbres distintos, identidade sonora, fonte licenciada,
nem qualidade percebida. O RMS é evidência de sinal, não uma avaliação de
qualidade.

Build e verificação descartáveis ocorreram no repositório de referência em
`/tmp/opendaw-test-reference`: `mise exec -- ./node_modules/.bin/tsc --noEmit
--pretty false` passou e `mise exec -- ./node_modules/.bin/vite build --config
vite.proof.config.ts` passou com avisos upstream sobre comentário PURE, `nam.wasm`
e chunks maiores que 500 kB. O servidor foi parado e a montagem removida ao
final. O harness customizado continua somente em `/tmp`, não é ainda um artefato
reprodutível versionado no Bardian.

Para evitar tráfego de terceiros no smoke test, a cópia temporária da página
removeu fontes Google e o contador externo. Os módulos e binários de runtime
vieram todos do mesmo host; a demo tentou buscar `/moises-dark-logo.svg` no host
local e recebeu 404, uma falha cosmética que não impediu a inicialização. Essa
prova confirma uma rota viável de assets e política escopada, mas não testa
integração de cabeçalhos via configuração Rails permanente nem efeito sobre
todas as páginas/recursos do Bardian.

## Leitura de arquitetura

O uso headless é tecnicamente possível, mas exige mais do que trocar uma chamada
de playback. É necessário inicializar serviços de projeto, instalar workers e
worklets, criar o grafo de caixas, converter faixas/regiões/eventos, configurar
instrumentos e efeitos e manter ciclo de vida do engine. O adaptador terá que
manter o JSON Rails como fonte persistida e traduzir os ticks e níveis de áudio
sem expor objetos openDAW aos controllers Stimulus.

O pacote WASM usa `SharedArrayBuffer`; a prova headless só ativou o engine sob
isolamento cross-origin. A documentação da referência usa `Cross-Origin-Opener-Policy:
same-origin` e `Cross-Origin-Embedder-Policy: require-corp`. Ainda falta avaliar
como limitar esses cabeçalhos às páginas de composição e como isso afeta
recursos externos atuais.

## Recursos versus responsabilidade do Bardian

| Reaproveitar do openDAW (a validar no Bardian) | Manter no Bardian |
|---|---|
| Engine WASM, AudioWorklet, relógio musical e modelo de projeto | Contrato JSON Rails e domínio musical |
| Grafo de sessão, roteamento, mixer e efeitos disponíveis | Assistência harmônica, explicação e regras de aprendizagem |
| Instrumentos e DSP quando assets/licenças forem aceitáveis | Interface orientada a iniciantes, timeline e piano roll existentes |
| Serviços de renderização offline, caso façam parte do escopo final | Decisão explícita de aplicar ou rejeitar uma sugestão |

## Licença e riscos

O pacote examinado declara AGPL-3.0-or-later; manter o código-fonte da licença
junto da distribuição. A licença do SDK não resolve automaticamente a licença
de instrumentos, samples, efeitos de terceiros ou dependências transitivas.
Cada fonte sonora precisa ter origem e permissão de uso documentadas. Esta
análise é técnica e acadêmica, não parecer jurídico.

## Decisão provisória e próximo critério

**Não migrar o playback de produção ainda.** O protótipo prova que o engine
headless inicializa e reproduz em um ambiente Vite isolado, e que a conversão
temporal é viável para uma fixture pequena. Ainda não prova execução sob Rails,
carregamento local via assets Rails, mute/solo, ciclo de vida no Bardian, nem
qualidade sonora adequada com instrumentos licenciados.

O ambiente Ruby foi localizado e ativado via mise (`mise.toml` fixa Ruby 4.0.7).
Os testes focados de composição/controlador passaram, e a prova descartável
demonstrou assets locais pelo middleware estático Rails com isolamento escopado.
Isso corrige a limitação anterior de PATH e resolve a incerteza de carregamento
local básico, sem alterar configuração permanente ou adicionar dependência ao
projeto.

Para fechar a etapa 1 sem inferências, ainda falta uma composição Bardian
persistida com duas faixas para repetir nela a prova de playback; selecionar e
confirmar licenças de fontes instrumentais distintas; medir latência; avaliar
qualidade auditiva e ciclo de vida. A prova sintética validou a tradução
estrutural e o loop do SDK, mas não substitui o gate com composição real. Não
iniciar a migração de produção antes disso.

## Fontes consultadas

- [openDAW SDK no npm](https://www.npmjs.com/package/@opendaw/studio-sdk)
- [Visão de arquitetura do openDAW](https://github.com/andremichelle/openDAW/blob/main/introduction.md)
- [Exemplo headless openDAW](https://github.com/andremichelle/opendaw-headless)
- [Demonstrações headless e exemplos de API](https://github.com/naomiaro/opendaw-test)
- [Licença GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html)
