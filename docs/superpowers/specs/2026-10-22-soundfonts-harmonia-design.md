# SoundFonts para a harmonia

## Estado e objetivo

Especificação aprovada para revisão técnica; a implementação ainda não começou.
O objetivo é ampliar os timbres disponíveis no compositor de harmonias usando
FluidR3 completo, melhorar o tempo de resposta depois do primeiro carregamento e
manter a escolha de timbre simples para pessoas sem conhecimento musical.

O usuário aprovou servir o banco pelo backend, incluí-lo na imagem Docker e
usar o armazenamento local do navegador para evitar baixá-lo novamente. Também
aprovou a paleta descrita abaixo. Esta autorização cobre a especificação; a
implementação depende da revisão do plano desta etapa.

## Situação técnica atual

- `config/harmony_instruments.json` contém quatro presets gerados pelo
  Vaporisateur: sintetizador suave, pad, dedilhado sintético e órgão sintético.
- `HarmonyInstrumentCatalog` expõe os identificadores e rótulos e valida o que
  pode ser persistido nas faixas.
- O toolbar da harmonia mostra os timbres em um seletor. O motor usa
  `InstrumentFactories.Vaporisateur` para todas as faixas.
- `harmony_engine.js` configura o gerenciador de SoundFonts com um provedor que
  falha deliberadamente. Portanto, a infraestrutura de áudio existe no SDK,
  mas está desabilitada no Bardian.
- O SDK aceita arquivos `.sf2`, comunica progresso do carregamento e guarda o
  arquivo no OPFS do navegador. Ele interpreta o arquivo em memória ao preparar
  o timbre; o cache evita nova transferência, mas não elimina interpretação nem
  o custo de memória.
- O banco completo FluidR3 GM possui aproximadamente 148 MB. A distribuição
  consultada declara licença MIT e fornece hash do arquivo para verificação.
  Preservar o texto da licença e os créditos no produto e na distribuição.
  Fonte e tamanho: [repositório FluidR3](https://github.com/pinkflames/fluid-soundfont).

## Paleta inicial

Manter os quatro IDs existentes para que composições salvas continuem válidas.
Acrescentar instrumentos do FluidR3 com nomes de fácil entendimento, incluindo:

- Piano acústico
- Piano elétrico
- Piano elétrico suave (opção para lo-fi)
- Violão de nylon
- Guitarra limpa
- Guitarra abafada (opção para lo-fi)
- Órgão
- Cordas suaves
- Coral suave
- Pad
- Vibrafone (opção para lo-fi)

Os IDs internos podem refletir os programas GM, mas a interface não deve exigir
que o usuário conheça números, famílias ou teoria musical. Não adicionar bateria,
efeitos, ruído de vinil/fita, upload de SoundFont ou edição de presets nesta
etapa. Os rótulos e a indicação lo-fi são orientações de escuta, não categorias
musicais obrigatórias.

## Fluxo de áudio e dados

```text
faixa salva com instrument_id
        ↓
catálogo compartilhado identifica preset interno ou SoundFont
        ↓
motor cria o instrumento apropriado e associa o FluidR3
        ↓
SDK carrega do OPFS ou busca o arquivo estático no mesmo domínio
        ↓
progresso/erro publicados para a interface; arquivo armazenado no OPFS
```

O documento de composição continua guardando apenas um `instrument_id` estável.
Não guardar URL, UUID de arquivo local nem uma cópia do banco por composição.
Manter `HarmonyInstrumentCatalog` como allowlist do backend. Alterações de
catálogo são compartilhadas pela configuração usada no frontend e no Rails,
evitando permitir que um payload salve fontes não instaladas.

O provedor do SDK deve buscar um caminho estático servido pelo mesmo domínio,
validar a resposta e reportar progresso. O carregamento sob demanda acontece na
primeira reprodução de uma composição que use SoundFont. Reproduções seguintes
reutilizam o OPFS. O estado visual deve comunicar carregamento, progresso,
falha e opção de tentar novamente em texto simples. A reprodução não deve ficar
indefinidamente em estado de carregamento.

## Distribuição do banco

FluidR3 será distribuído junto à imagem Docker como recurso estático do Bardian,
sem passar por controller Rails, banco de dados ou endpoint de upload. A URL
deve ser estável e same-origin para funcionar com os cabeçalhos de isolamento
do áudio já adotados pelo projeto. A imagem precisa incluir licença, créditos e
hash SHA-256 fixado; o processo de build/empacotamento deve falhar se o hash não
corresponder.

O método de origem do arquivo ainda precisa ser fechado no plano: armazenar o
binário no repositório (com o custo de um arquivo de 148 MB) ou obtê-lo no build
a partir de uma origem fixada e validar o hash. Não escolher uma estratégia que
torne o deploy dependente de download não versionado. Nenhuma dependência de
runtime nova deve ser necessária.

## Escopo técnico previsto

- Catálogo compartilhado, validação e compatibilidade de composições existentes.
- Integração com `SoundfontService`, `GlobalSoundfontLoaderManager`, factory e
  adaptadores públicos do SDK, sem alterar o domínio musical.
- Provisionamento do asset estático na imagem Docker e cabeçalhos de resposta.
- Estado de progresso, erro e nova tentativa na interface de reprodução.
- Licença, créditos, hash e atualização da documentação de áudio.
- Testes focados no catálogo, mapeamento de presets, provedor e estados de erro;
  verificação de build e reprodução fria/quente no navegador.

Arquivos prováveis: `config/harmony_instruments.json`,
`app/models/harmony_instrument_catalog.rb`, `app/audio_engine/harmony_engine.js`,
`app/audio_engine/harmony_instruments.js`,
`app/javascript/audio/opendaw_harmony.js`,
`app/javascript/controllers/harmony_controller.js`, partials da harmonia,
`Dockerfile`, documentação de áudio, testes e `config/dev_reports.yml`.
A extração de partials deve ser decidida após inspecionar a estrutura real da
view; manter ERB responsável apenas pela apresentação.

## Limites, falhas e riscos

- Primeiro download e interpretação podem demorar, sobretudo em rede móvel ou
  aparelho com pouca memória. Mostrar progresso da transferência e erro; não
  prometer progresso da interpretação se o SDK não o fornecer.
- Se o OPFS não estiver disponível ou a gravação falhar, informar a falha e
  oferecer nova tentativa, sem salvar silenciosamente o banco em outra camada.
- Arquivo ausente, resposta HTTP inválida, hash incorreto ou banco inválido
  devem impedir o instrumento de iniciar e produzir mensagem recuperável.
- A inclusão do banco aumenta significativamente a imagem Docker e o tráfego do
  primeiro uso por usuário. O ganho é reduzir ida a serviços de terceiros e
  manter o asset sob controle de distribuição do Bardian.
- Não há garantia de que a interpretação de 148 MB seja rápida em todo
  dispositivo; observar compatibilidade e memória durante a validação auditiva.
- A paleta é deliberadamente pequena; expor os 128 programas GM agora ampliaria
  o esforço de escolha e o escopo de assistência.

## Verificação prevista

1. Confirmar preservação dos quatro IDs e aceitação dos novos IDs no catálogo e
   no contrato de composição.
2. Confirmar associação correta de cada timbre à fonte e ao programa do FluidR3.
3. Verificar carregamento frio com progresso, cache OPFS numa nova reprodução,
   falha de rede e nova tentativa.
4. Validar o caminho e o hash do asset dentro da imagem Docker, com cabeçalhos
   necessários ao motor de áudio.
5. Ouvir as harmonias da paleta e conferir que trocar o timbre não muda notas,
   tempo, volume, mute, solo ou dados persistidos além do identificador escolhido.
6. Registrar limitações de tempo de carga, consumo de memória, navegador e
   dispositivo usados na avaliação.

## Decisões não incluídas

Esta etapa não cria upload, catálogo de bancos alternativos, escolha por gênero,
efeitos lo-fi, samples de bateria, VST ou renderização offline. A fonte
SoundFont e a lista de instrumentos podem ser revistas em uma etapa futura, com
nova decisão explícita.

## Revisão de produção — 22/10/2026

O plano foi corrigido após inspeção do SDK instalado: banco/programa GM devem
ser resolvidos para a posição real no array de presets; a preparação do motor
precisa ser assíncrona e esperar também os recursos do processador. URL e UUID
do banco devem identificar a versão do conteúdo para invalidar cache antigo.
A prova com o FluidR3 completo precede a expansão do catálogo e deve medir
memória, primeira nota e tempos de carga fria, cache e reutilização de sessão.

O modelo continua sob demanda, com espera no primeiro uso. A revisão não
comprova desempenho nem entrega da funcionalidade. A origem exata do artefato,
o SHA-256 e os avisos do pacote permanecem pendentes de confirmação antes do
build. O plano detalha também instalação local, recuperação de cache corrompido
e falhas do loader que podem não publicar estado final.


## Execução — 23/10/2026

As pendências de origem foram resolvidas com o pacote Debian FluidR3 3.1, com
hashes e créditos em `config/soundfonts.json` e `docs/third-party/`. A integração
usa SoundfontService e um carregador que implementa o contrato público do SDK,
com SoundfontStorage para OPFS, para propagar erros e recuperar cache corrompido.
Foram incluídos os 11 instrumentos aprovados e preservados os quatro anteriores.
Resultados locais e limites de memória/carregamento estão em
`docs/harmonia-opendaw.md`; validação do container de produção permanece pendente
por indisponibilidade do daemon Docker. Não há validação auditiva humana ainda.
