# Decisão: reprodução no navegador com Tone.js e Salamander

Data: 2026-10-06. Estado: adotada para a demonstração inicial de áudio.

## Contexto e objetivo

O Bardian precisa permitir que o usuário ouça os elementos musicais que
cria e estuda. A reprodução deve usar a representação musical do projeto
sem introduzir dependências de áudio nas classes de domínio.

Este incremento valida o carregamento de um timbre de piano e sua execução
no navegador. A decisão é de engenharia, voltada à simplicidade do MVP e ao
escopo do TCC; não constitui uma exigência musical nem uma conclusão
experimental sobre qualidade sonora ou aprendizagem.

## Decisão tecnológica

- Usar **Tone.js 15.1.22** para controlar a reprodução pela Web Audio API.
- Usar **Tone.Sampler** com um sample do **Salamander Grand Piano**, de
  Alexander Holm, como fonte sonora inicial.
- Manter a biblioteca, suas dependências incorporadas e o sample no
  repositório, servidos pela própria aplicação, sem CDN durante o uso.
- Integrar a demonstração à estrutura existente de Rails, Importmap e
  Stimulus, na rota `/audio_demo`.

Tone.js é a biblioteca de reprodução; Salamander fornece a gravação usada
como timbre. A escolha do piano não determina quais escalas e acordes o
domínio pode representar.

Tone.js reduz o código necessário para carregar e executar samples em
comparação com o uso direto da Web Audio API. Essa conveniência introduz
uma dependência de frontend, cuja atualização e compatibilidade precisam
ser acompanhadas. Salamander permite experimentar um timbre de piano
gravado com atribuição de autoria preservada.

## Separação de responsabilidades

| Parte | Responsabilidade atual |
|---|---|
| Domínio em Ruby | Representar notas, intervalos, escalas e acordes, independentemente da reprodução. |
| Rails e Importmap | Entregar a página e disponibilizar os módulos JavaScript locais. |
| Controller Stimulus | Carregar o sampler, responder ao clique, informar estados e liberar recursos. |
| Tone.js | Controlar o contexto de áudio e a execução do sample no navegador. |
| Salamander | Fornecer o arquivo de áudio usado pelo sampler. |

A demonstração usa a nota fixa `A4`. Ainda não existe um contrato de dados
entre as classes Ruby e o reprodutor. A conversão de notas do domínio em
eventos reproduzíveis será um incremento separado: deverá preservar a
grafia musical no domínio e definir explicitamente altura, duração e
tempo de execução necessários ao áudio.

Tone.js não executa no backend Ruby. Sua adoção prepara o lado de
reprodução da interface, mas não implementa por si só essa integração.

## Arquivos e distribuição local

| Arquivo | Finalidade |
|---|---|
| `vendor/javascript/tone.js` | Bundle local do Tone.js com dependências de execução incorporadas. |
| `config/importmap.rb` | Mapeamento do nome `tone` para o arquivo local. |
| `app/javascript/controllers/audio_demo_controller.js` | Ciclo de vida e interação da demonstração. |
| `app/views/audio_demo/index.html.erb` | Botão e mensagem de estado. |
| `public/audio/salamander/A4.mp3` | Sample inicial de Lá4. |

O bundle foi obtido do esm.sh. O download inicial por Importmap deixou
referências a módulos internos ausentes; por isso foi substituído pelo
bundle com dependências incorporadas. O esm.sh é uma origem de aquisição,
não uma dependência de rede em tempo de reprodução.

As origens, o hash do bundle e a alteração feita nele estão em
[SOURCES.txt](../vendor/licenses/SOURCES.txt). O source map consultado
identifica os pacotes internos, mas não suas versões resolvidas; o hash
identifica o artefato efetivamente incluído. Uma atualização deve conferir
novamente dependências, licenças, ausência de importações externas e
comportamento no navegador.

Os arquivos locais permitem reproduzir sem consultar serviços externos
de áudio. Isso não equivale a suporte completo offline: a aplicação ainda
precisa estar acessível, e não foi implementada uma estratégia de cache
offline. O projeto também assume o armazenamento e a entrega dos assets.

## Comportamento implementado

1. Ao conectar o controller, criar um sampler e carregar `A4.mp3` de
   `/audio/salamander/`, mantendo o botão desabilitado.
2. Quando o carregamento terminar, habilitar o botão e informar que o
   piano está pronto. Em caso de falha, manter o botão desabilitado e
   orientar o recarregamento da página.
3. Após o clique, chamar `Tone.start()` para ativar o áudio por interação
   do usuário e executar `A4` com duração de 0,5 segundo.
4. Usar volume de −12 dB e release de 0,5 segundo. O release controla o
   decaimento após a liberação da nota; não é uma duração adicional do domínio.
5. Ao desconectar, descartar o sampler sem fechar o contexto compartilhado
   do Tone.js. Retornos assíncronos de um sampler descartado são ignorados.

Falhas ao iniciar o áudio exibem uma mensagem e permitem uma nova tentativa.
A mensagem de reprodução indica que o comando foi executado; não comprova
que a saída física de áudio esteja audível.

## Alternativas consideradas

| Alternativa | Avaliação para esta etapa |
|---|---|
| Web Audio API diretamente | Evitaria Tone.js, mas exigiria implementar mais detalhes de carregamento e execução. |
| Síntese por oscilador | Servia à demonstração anterior; não validava o uso de uma gravação de piano. |
| Biblioteca e samples via CDN | Reduziria os arquivos locais, mas acrescentaria dependência de rede e disponibilidade externa durante o uso. |
| Coleção completa de samples | Ampliaria a cobertura do instrumento e o volume de assets; foi adiada para manter o incremento pequeno. |

## Licenças e atribuição

Tone.js é distribuído sob licença MIT. Os textos de licença da biblioteca
e dos pacotes incorporados estão em [vendor/licenses](../vendor/licenses/),
com suas fontes registradas em `SOURCES.txt`.

Para o sample, foi preservada a indicação **Creative Commons Attribution
3.0** da distribuição utilizada, com crédito a **Alexander Holm**. O arquivo
de áudio não foi modificado. Consulte os
[créditos e a origem](../public/audio/salamander/SOURCE.txt) e o
[README original](../public/audio/salamander/README.upstream).
A atribuição deve acompanhar a distribuição desses assets.

## Validação e limites

Na implementação inicial, foram verificados no navegador o carregamento,
o acionamento da reprodução, a mensagem e o bloqueio do botão quando o
sample estava ausente, além da recuperação ao restaurar o arquivo e
retornar à página. A conferência auditiva pelo autor permanece pendente.

A suíte Ruby passou com 70 testes e 479 verificações, sem falhas ou erros,
usando `PARALLEL_WORKERS=1 mise exec -- bin/rails test`. Essa suíte verifica
o comportamento Ruby existente; não substitui os testes de áudio no navegador.

O incremento inclui apenas um sample de Lá4. Não representa a instalação
completa do Salamander, nem valida a qualidade de outras alturas, camadas
de intensidade, reprodução de escalas ou acordes, sequenciamento,
exportação de áudio ou seleção de instrumentos.

A decisão pode ser revista conforme esses requisitos forem discutidos.
Ampliação do conjunto de samples e integração com o domínio precisam de
novos incrementos explícitos, preservando a separação entre teoria musical
e tecnologia de reprodução.
