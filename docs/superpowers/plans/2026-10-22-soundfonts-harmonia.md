# SoundFonts para a harmonia — Plano de implementação

> **Para agentes implementadores:** sub-habilidade obrigatória: usar `superpowers:executing-plans` ou `superpowers:subagent-driven-development` para executar este plano tarefa por tarefa. Cada etapa usa caixas de seleção.

**Objetivo:** disponibilizar uma paleta curta de instrumentos FluidR3 no compositor de harmonia, com download sob demanda, cache OPFS e estados claros de carregamento e erro.

**Arquitetura:** o catálogo compartilhado mantém IDs estáveis e discrimina presets locais de presets SoundFont. O build inclui o asset estático na imagem Docker; o motor openDAW recebe um provedor same-origin para o `.sf2` e resolve banco/programa para o índice real do preset antes de criar o instrumento. A composição continua persistindo somente `instrument_id`; OPFS guarda o arquivo por navegador.

**Stack:** Rails, Ruby, JavaScript ES modules, SDK openDAW já instalado, Docker e testes Rails/JavaScript existentes. Nenhuma dependência nova de runtime.

**Especificação:** `docs/superpowers/specs/2026-10-22-soundfonts-harmonia-design.md`.

## Restrições globais

- Preservar os quatro IDs de instrumento atuais para compatibilidade com composições existentes.
- Não persistir URL nem UUID de SoundFont no documento musical.
- Servir FluidR3 na mesma origem, incluído na imagem Docker e com licença, créditos e SHA-256 fixado.
- Mostrar carregamento, progresso de transferência, erro recuperável e opção de tentar novamente; não inventar progresso de parsing.
- Usar armazenamento OPFS do SDK; não introduzir fallback silencioso para outro armazenamento.
- Não adicionar VST, upload, bateria, ruídos, efeitos ou catálogo completo de 128 programas.
- Documentar em português as funções, parâmetros, retornos, regras e decisões não triviais do código novo ou alterado.
- Manter ERB como apresentação; consultas e regras ficam nas camadas existentes.

## Foco de revisão

- Resposta estática ausente ou diferente de 200: a reprodução falha com estado recuperável e não marca a sessão como tocando (tarefa 3).
- Arquivo truncado ou com hash divergente durante empacotamento: o build falha antes de produzir imagem (tarefa 1).
- Falha do OPFS ou falta de suporte: informar erro legível e permitir nova tentativa, sem marcar cache como pronto (tarefa 3).
- IDs antigos em composições persistidas: continuam válidos e selecionam o preset original (tarefa 2).
- Troca de timbre durante carregamento ou reprodução: a última intenção do usuário prevalece e uma promessa anterior não inicia áudio obsoleto (tarefa 3).

---

## Mapa de arquivos e responsabilidades

- `config/harmony_instruments.json`: catálogo compartilhado de IDs, rótulos, origem (`vaporisateur` ou `fluid_r3`), programa e indicação de uso lo-fi.
- `app/models/harmony_instrument_catalog.rb`: expõe opções simples e mantém a validação allowlist dos IDs.
- `app/audio_engine/harmony_engine.js`: constrói serviço/provedor openDAW e seleciona factory pelo tipo de instrumento.
- `app/audio_engine/harmony_instruments.js`: conserva configuração dos quatro presets sintetizados; não conter regras de programa GM.
- `app/javascript/audio/opendaw_harmony.js`: converte progresso do motor em estado público sem quebrar a proteção contra sessões assíncronas obsoletas.
- `app/javascript/controllers/harmony_controller.js`: traduz estado técnico em mensagens curtas em português e permite nova tentativa pelo botão de reprodução.
- `app/views/harmony/_toolbar.html.erb` e partials relacionados: apresentam nomes amigáveis e indicação curta para os timbres lo-fi.
- `Dockerfile` e diretório público do asset: disponibilizam o `.sf2` estático com hash validado durante o build.
- `config/deploy.yml`: só alterar se o asset não fizer parte da imagem atual de runtime; não montar SoundFont em banco ou volume persistente.
- `test/models/harmony_instrument_catalog_test.rb`, `test/javascript/harmony_instruments_test.mjs`, novos testes JavaScript focados e testes de integração de harmonia: fixam compatibilidade e estados relevantes.
- `docs/harmonia-opendaw.md`, aviso de licença do asset e `config/dev_reports.yml`: registram instalação, licença, verificação e entrega concluída.

## Decisão de empacotamento proposta

Baixar no build Docker o arquivo upstream de FluidR3 a partir de uma URL imutável de release/artefato, verificar SHA-256 e copiar o resultado para `public/audio/soundfonts/`. Fixar também a versão e a origem documental; nenhuma tag mutável. Isso evita armazenar 148 MB no Git regular e garante que deploys sem o arquivo parem no build. **Trade-off:** builds limpos passam a depender da disponibilidade da origem; se essa disponibilidade for inaceitável, substituir por armazenamento versionado fora do Git regular antes da implementação. A URL imutável exata e o SHA devem ser confirmados a partir da fonte escolhida na tarefa 1.

## Tarefa 1: fixar e servir o asset licenciado

**Arquivos:**
- Modificar `Dockerfile`.
- Criar `public/audio/soundfonts/README.md` ou aviso equivalente junto ao asset no contexto de build.
- Modificar `.dockerignore` apenas se necessário para preservar o asset de build.
- Verificar `config/deploy.yml` sem mudar volumes que não precisem de alteração.

**Interfaces:** produz `GET /audio/soundfonts/<sha256>/FluidR3_GM.sf2` same-origin, com resposta estática e tamanho/hash previsíveis; o container falha se o hash calculado não for o fixado.

- [x] Confirmar na fonte primária o artefato imutável, o SHA-256, a licença e os créditos; registrar URL e checksum junto ao código.
- [x] Ajustar o build Docker para obter o arquivo de forma reproduzível, verificar SHA-256 antes de copiá-lo e incluir avisos de licença na imagem.
- [ ] Verificar a imagem/build e a resposta HTTP estática, inclusive tamanho e cabeçalhos MIME/cache apropriados sem atravessar controller Rails.

## Tarefa 1B: prova de reprodução do banco completo

Esta prova é condição para ampliar a paleta. Usar o SDK instalado e o banco integral, com um piano e uma faixa. Medir download, leitura do cache, parsing, preparação no worklet e primeira nota audível separadamente. A API expõe `queryLoadingComplete()`; confirmar sua semântica com o SoundFont no motor WASM antes de usá-la como barreira. `engine.isReady()` sozinho indica a inicialização do motor, não a disponibilidade do banco.

- [x] Criar um `SoundfontFileBox` no grafo com identidade estável para a versão do banco e passá-lo em `attachment` à factory Soundfont. Usar o provider/loader para o banco distribuído; não chamar `SoundfontService.importFile`, que abre confirmação de importação para arquivos grandes e depende da interface do SDK.
- [ ] Confirmar o caminho de transferência para WASM e medir memória além dos 148 MB do arquivo: parsing, amostras PCM, cópias e memória WASM também contribuem para o pico.
- [ ] Verificar primeira nota completa após carga fria, após recarga com OPFS e ao alternar entre prévia e composição. Se a prova falhar, registrar causa e interromper apenas a expansão da paleta; trocar engine, fragmentar banco ou migrar renderização exige nova decisão.

## Tarefa 2: catálogo e associação de presets

**Arquivos:**
- Modificar `config/harmony_instruments.json` e `app/models/harmony_instrument_catalog.rb`.
- Modificar `app/audio_engine/harmony_engine.js` e `app/audio_engine/harmony_instruments.js`.
- Atualizar `test/models/harmony_instrument_catalog_test.rb` e `test/javascript/harmony_instruments_test.mjs`.

**Interfaces:** cada entrada possui ID estável, `label`, `source`, e `bank` e `program` somente quando `source` for `fluid_r3`; `options` continua devolvendo os campos necessários à interface sem expor detalhes internos desnecessários. Os IDs SoundFont usam nomes legíveis em snake_case. O motor cria Vaporisateur para `source: vaporisateur` e Soundfont para `source: fluid_r3`, associando arquivo instalado e índice de programa.

Programas GM internos (numeração zero-based): piano acústico 0; piano elétrico (Electric Piano 1): 4; piano elétrico suave (Electric Piano 2): 5; violão de nylon 24; guitarra limpa 27; guitarra abafada 28; órgão Drawbar 16; cordas suaves (String Ensemble 2) 49; coral (Choir Aahs) 52; pad Warm 89; vibrafone 11. Essa numeração é interna e não deve aparecer na interface. Referência da lista GM e convenção zero-based: [MEI data.MIDINAMES](https://music-encoding.org/guidelines/v4/data-types/data.midinames.html).

- [x] Cobrir IDs atuais, IDs novos, rótulos, fonte e índices de programa; verificar que catálogo Rails rejeita ID desconhecido.
- [x] Implementar metadados de catálogo e manter os quatro IDs atuais sem alteração.
- [ ] Configurar o provedor `SoundfontProvider.fetch(uuid, progress)` para buscar o asset same-origin, emitir progresso e devolver `[ArrayBuffer, SoundfontMetaData]` ao loader openDAW; rejeitar resposta HTTP ruim e arquivo sem conteúdo.
- [x] Criar instrumentos com a factory correta e resolver o índice pela combinação `preset.header.bank === bank` e `preset.header.preset === program`, exigir exatamente uma correspondência e só então definir `presetIndex`; preservar volume, mute, solo, notas e mapeamento de composição.
- [x] Verificar testes focados de catálogo, configuração de presets e mapeamento existente.

Todos os programas desta seleção usam banco MIDI 0. `presetIndex` é posição no array `soundfont.presets`, não número GM: o adaptador instalado acessa `presets[presetIndex]` e recorre silenciosamente ao primeiro preset se o índice for inválido. O Bardian deve validar a correspondência antes desse ponto. Incluir um caso com presets fora de ordem e outro com programa ausente.

## Tarefa 3: progresso, falhas e nova tentativa

**Arquivos:**
- Modificar `app/javascript/audio/opendaw_harmony.js` e `app/javascript/controllers/harmony_controller.js`.
- Ajustar `app/views/harmony/_toolbar.html.erb` ou partial de status já existente, conforme o HTML atual.
- Criar teste JavaScript focal para estados do carregador; ampliar teste de controller existente apenas onde cobre comportamento público.

**Interfaces:** `onState` publica `{ status, positionTick, progress? }`, sendo `progress` um número entre 0 e 1 apenas durante transferência de SoundFont. Estados sem SoundFont mantêm o contrato atual. Erros mantêm `status: "error"`, liberam tentativa seguinte e preservam o documento.

- [x] Criar casos para progresso crescente, progresso inválido ignorado/limitado, erro HTTP/OPFS e tentativa seguinte bem-sucedida.
- [x] Propagar progresso sem permitir que callbacks de uma sessão antiga alterem a interface ou iniciem áudio após nova tentativa.
- [x] Exibir texto simples em português: carregamento com percentual quando disponível, reprodução, erro e tentativa novamente pelo controle existente.
- [ ] Verificar o teste JavaScript focal e renderização da barra/estado em telas suportadas, preservando a regra do projeto de não haver rolagem da página inteira.

## Tarefa 4: paleta, documentação e entrega

**Arquivos:**
- Modificar partials da harmonia somente se necessário e manter a view principal estrutural.
- Atualizar `docs/harmonia-opendaw.md` e `config/dev_reports.yml`.
- Revisar testes existentes afetados e registrar limitações medidas.

**Interfaces:** a interface apresenta os nomes aprovados: piano acústico, piano elétrico, piano elétrico suave, violão de nylon, guitarra limpa, guitarra abafada, órgão, cordas suaves, coral suave, pad e vibrafone, além dos quatro presets anteriores. Uma dica sucinta identifica as opções para lo-fi sem alterar a categoria musical do instrumento.

- [x] Verificar catálogo renderizado, seleção persistida e indicação de lo-fi sem expor números GM ao usuário.
- [x] Documentar fluxo, armazenamento OPFS, licença, créditos, checksum, empacotamento e limitações de memória/carga.
- [ ] Executar testes focados Rails/JavaScript, build de assets e smoke test de resposta do arquivo no container.
- [ ] Validar reprodução fria (primeiro download) e quente (reutilização após recarga), além de erro e nova tentativa; registrar navegador, aparelho, tempos observados e limites.
- [x] Revisar os arquivos ERB e responsabilidades, verificar o diff completo e registrar a entrega no DevReport com limitações conhecidas.

## Correções da revisão de produção — 22/10/2026

As seguintes condições complementam e prevalecem sobre formulações mais gerais das tarefas acima. A revisão é documental e baseada no código instalado; não é uma validação de reprodução já realizada.

### Identidade, distribuição e ambiente local (tarefa 1)

Criar `config/soundfonts.json` com versão, URL de origem fixada, SHA-256 do arquivo final, tamanho, caminho público, UUID estável da versão, licença e créditos. Origem e checksum ainda são pendências factuais: fechar antes de alterar o Dockerfile e não declarar distribuição reproduzível enquanto faltarem. Se a origem for um arquivo compactado, verificar também seu checksum e o do `.sf2` extraído. Conferir licença no pacote efetivamente distribuído.

Criar `bin/setup-soundfonts` para instalar e validar o mesmo artefato no desenvolvimento e no build Docker. Falhar antes de substituir um arquivo válido; usar arquivo temporário e renomeação após verificação. Ignorar binários baixados no Git. Isolar aquisição em camada de build reaproveitável. Não baixar no boot do container nem durante uma requisição Rails.

URL pública com SHA-256 e UUID de cache associados à versão impedem reutilizar OPFS antigo após uma atualização. Um UUID aleatório por sessão faria baixar o banco novamente. Garantir que o arquivo e os avisos estejam na imagem final, que o usuário de runtime consiga lê-los e que o pipeline Vite com `emptyOutDir` não os remova. Verificar a rota pelo servidor real de produção (Thruster/Rails), MIME e cache HTTP; same-origin por si só não exige replicar todos os cabeçalhos dos workers no SF2.

### Preparação assíncrona e concorrência (tarefas 2 e 3)

Alterar `engine.prepare(document, callbacks)` para retornar uma Promise. O transporte deve aguardá-la e revalidar seu token de intenção antes de `seek`/`play` e antes de marcar `preparedKey`. Preparações concorrentes precisam de cancelamento ou serialização para que uma antiga não substitua o grafo mais recente. Preservar comportamento de pausar, parar, editar, trocar timbre e sair da página durante a carga.

A sequência é obter banco, resolver preset por banco/programa, montar grafo, aguardar recursos do processador e só então iniciar transporte. Download a 100% deve mudar o texto para “Preparando os instrumentos…”; só declarar “Tocando” após a barreira de prontidão. Sem tamanho confiável, exibir progresso indeterminado. Compartilhar carregamento/objeto interpretado entre faixas da sessão e evitar novo parsing a cada prévia.

Cobrir em `test/javascript/opendaw_lifecycle_test.mjs`: cancelamento durante prepare, duas preparações concluídas fora de ordem, erro seguido de retry e ausência de início antes da prontidão. Manter os casos de `test/javascript/opendaw_mapping_test.mjs`. Testar resolver em `test/javascript/harmony_soundfonts_test.mjs`, com funções pequenas em `app/audio_engine/harmony_soundfonts.js` para provedor, resolução e observação de carregamento.

### Recuperação e limites do SDK (tarefa 3)

O loader instalado pode apenas registrar falha ao importar o parser, sem publicar estado final; no caminho de download, uma exceção de parsing também pode não chegar ao consumidor. A espera do Bardian precisa de limite, limpeza de assinaturas e tratamento de rejeição. Timeout não interrompe parsing síncrono nem corrige congelamento da thread principal; a prova deve medir esse risco.

Ler o estado atual além de assinar o loader: uma assinatura posterior ao erro não recebe automaticamente aquele estado. Na tentativa seguinte, invalidar/recriar o loader que falhou. Se os bytes em OPFS estiverem corrompidos, invalidar apenas o banco afetado antes de baixar novamente; repetir a leitura dos mesmos bytes não recupera a reprodução. Diferenciar cache ausente, cache corrompido e armazenamento indisponível. Não limpar dados de composições nem todo o armazenamento da origem.

### Experiência e critério de entrega (tarefa 4)

O modelo aprovado carrega sob demanda: a primeira escuta ainda paga o download e a preparação. O cache melhora repetições, mas pode ser removido pelo navegador e não garante execução offline completa. Antecipar download ao abrir a página é uma alternativa futura, com custo de tráfego, e não faz parte desta implementação.

Distinguir os dois pads na apresentação, usando “Pad sintético” para o existente e “Pad suave” para FluidR3, preservando IDs. Lo-fi indica sugestões de instrumentos, não processamento sonoro especial. Fazer checagem auditiva de volume e clipping dos timbres; não alterar o volume salvo da faixa para compensar o preset.

Registrar separadamente tempo da primeira carga, primeira escuta após recarga, nova escuta na mesma sessão e troca de timbre; medir primeira nota e ausência de silêncio inicial. Registrar dispositivo, navegador, rede e memória observada. Nenhum teste de mock substitui esta prova com o banco real. Só marcar tarefas concluídas e atualizar DevReport de entrega após execução e verificação; limitações e bloqueios devem ser explicitados.

## Fora do escopo

Upload de SoundFonts; selecionar outros bancos; instrumentos de bateria/percussão; efeitos ou ruídos lo-fi; editor de preset; VST; renderização offline; migração do contrato musical; mudanças não necessárias na arquitetura de áudio.

## Resultado da execução — 23/10/2026

Implementação local entregue. Origem e hashes confirmados no pacote Debian 3.1;
ver `config/soundfonts.json` e avisos em `docs/third-party/`. A prova inicial do
banco integral precedeu a ampliação da paleta. Os 11 programas foram localizados
nos 189 presets reais. O provider planejado foi substituído por um carregador
pequeno que implementa o contrato público do SDK e usa seu SoundfontStorage:
essa decisão permite observar parsing, timeout e recuperação do cache sem alterar
o SDK. Nenhuma dependência de runtime foi adicionada.

As caixas abertas acima representam verificações parciais: não houve build nem
smoke test do container porque o daemon Docker está indisponível. Renderização
Rails foi coberta, mas a matriz visual não foi repetida. Medimos preparação total
e sinal de saída, não cada fase individual nem qualidade auditiva. Heap JS não
inclui toda a memória WASM/processo. Os tempos e limites estão em
`docs/harmonia-opendaw.md`. A entrega no DevReport corresponde à integração local,
não a uma homologação de produção. Não foram feitos commit, push ou deploy.
