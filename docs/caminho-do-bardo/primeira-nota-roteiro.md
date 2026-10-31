# Primeira taverna — Os primeiros tempos

Estado: as sete aulas estão publicadas; as aulas 2 a 7 foram implementadas em 29 de outubro de 2026.
Data: 24 de outubro de 2026.

## Objetivo e limites

Ajudar uma pessoa sem experiência musical a ouvir diferenças, reconhecer notas e organizar uma pequena ideia no tempo. A sequência é uma sugestão: a leitura permanece livre e a conclusão é uma decisão do estudante. Exercícios não bloqueiam o avanço.

“Taverna” é, nesta etapa, uma organização editorial. O catálogo existente continua contendo aulas individuais; agrupamento persistente, recompensas novas e mudanças de rotas precisam de uma etapa própria. Este roteiro prepara conteúdo, sem introduzir outro motor de áudio ou duplicar regras musicais do domínio.

Por decisão do usuário, a primeira aula a redigir será **Sentindo os tempos da música**. A abordagem começa pela pulsação e pela contagem simples antes de introduzir os nomes das notas. Cada aula deve conter explicação desenvolvida, exemplos comparados, experiência guiada, interpretação do resultado, aplicação no Bardian e revisão. Profundidade será avaliada pela cobertura desses elementos, não por um número artificial de parágrafos.

## Estrutura comum da página

- Abertura: uma situação concreta da viagem e o que a pessoa aprenderá.
- Objetivos: duas ou três ações observáveis.
- Explicação: conceitos introduzidos em sequência, com vocabulário explicado no contexto.
- Experimentos: controles de ouvir novamente e parar, legenda visual e descrição textual equivalente.
- Prática guiada: instruções, resultado esperado e explicação de outras respostas possíveis.
- Aplicação: relação com uma função já existente do Bardian, sem prometer controles inexistentes.
- Revisão: perguntas com respostas explicadas; conclusão manual disponível sem avaliação obrigatória.

A view principal mantém título, navegação e conclusão. O corpo editorial de cada aula utiliza o partial previsto pelo catálogo. Exemplos sonoros e visuais com interação própria podem ganhar partials compartilhados quando implementados; recebem dados musicais preparados fora da view. Consultas e progresso continuam no controller/modelo.

## Aula 1 — Sentindo os tempos da música

**Resumo da taverna:** Descubra como acompanhar a batida de uma música e perceber os tempos, mesmo sem saber tocar um instrumento.

**Abertura simples:** Imagine passos regulares numa estrada: um, dois, três, quatro. Na música, podemos acompanhar uma referência parecida. Cada batida dessa contagem é um tempo. Nesta primeira experiência, vamos chamar essa sequência regular de pulsação. A contagem até quatro é um exemplo para praticar, não uma regra para toda música.

**Resultado:** acompanhar uma pulsação regular e perceber a diferença entre dois andamentos.

**Desenvolvimento:** começar batendo palmas com uma sequência regular; chamar essa referência de pulsação. Introduzir BPM como quantidade de pulsações por minuto quando essa unidade de pulso está definida. Comparar andamento com quantidade de notas: mais notas não implica necessariamente BPM maior. Reconhecer que a percepção de pulso pode variar em música real.

**Som:** pulsos a 60 e 90 BPM e uma frase idêntica nos dois andamentos. Exemplos curtos, reiniciáveis e interrompíveis.

**Visual:** marcador pulsante acompanhado por contador e indicação textual de BPM. A animação é complementar; com movimento reduzido, usar indicação estática e contagem legível.

**Prática:** acompanhar quatro ou oito pulsos; ouvir duas frases com ritmos diferentes no mesmo andamento e identificar a referência comum. Não medir precisão motora ou exigir microfone.

**Revisão:** distinguir “mais rápido” de “mais eventos dentro do mesmo pulso”. Explicar o que acontece com a duração em segundos quando o BPM aumenta.

**Bardian:** localizar o andamento e relacioná-lo à reprodução sem alterar a composição do usuário durante a aula.

## Aula 2 — Duração, pausas e ritmo

**Resultado:** organizar eventos de um, dois e meio pulso e compreender pausas como parte do ritmo.

**Desenvolvimento:** usar o pulso como unidade de comparação. Introduzir duração e início separadamente; mostrar que dois eventos com a mesma duração podem começar em momentos diferentes. Construir um ritmo com pausas e subdivisão em duas partes iguais. Figuras musicais podem aparecer como vocabulário auxiliar, com a unidade explicitada, sem tornar leitura de partitura um pré-requisito.

**Som:** mesma nota repetida em três padrões; depois mesmo padrão com alturas diferentes. Comparar nota sustentada por dois pulsos com duas notas de um pulso.

**Visual:** grade horizontal de quatro pulsos com subdivisões e blocos de duração proporcional. Identificar intervalos vazios como pausas e explicar cada eixo.

**Prática:** acompanhar “som, som, pausa, som”; transformar dois eventos curtos em um longo e ouvir a diferença de articulação. Mostrar resposta possível sem afirmar que há um único ritmo musicalmente correto.

**Revisão:** distinguir pausa, fim de nota e nota sustentada. Explicar por que número de notas e duração total são medidas diferentes.

**Bardian:** relacionar largura e posição de eventos ao tempo. A aula prepara a edição, sem criar outro formato de eventos.

## Aula 3 — Compassos e acentos

**Resultado:** acompanhar agrupamentos simples de três e quatro pulsos e reconhecer o começo de um compasso.

**Desenvolvimento:** agrupar uma pulsação contínua; introduzir compasso como organização métrica. Mostrar acento de referência e distinguir essa referência de uma obrigação de tocar forte. Apresentar 3/4 e 4/4 com semínima como unidade nesses exemplos. Explicar numerador e denominador sem generalizar a leitura para todos os compassos, especialmente os compostos.

**Som:** contagem 1–2–3 e 1–2–3–4, seguida de padrões no mesmo BPM. Evitar atribuir caráter emocional universal a cada compasso.

**Visual:** grade com barras, números dos pulsos e limites dos compassos. Acento identificado também por texto ou forma.

**Prática:** acompanhar dois compassos e localizar a volta ao primeiro pulso. Deslocar um acento dentro do exemplo para perceber que acento executado e posição métrica não são sinônimos.

**Revisão:** explicar por que uma barra de compasso não exige silêncio e por que quatro pulsos podem conter mais de quatro notas.

**Bardian:** relacionar contagem às divisões temporais que a interface realmente oferece; confirmar suporte antes de propor alteração de fórmula de compasso.

## Aula 4 — Som, silêncio e escuta

**Resultado:** perceber que uma música organiza sons e silêncios, e descrever diferenças sem precisar ler partitura.

**Desenvolvimento:** começar pela paisagem sonora da taverna; separar ouvir um evento e prestar atenção nele. Apresentar duração, altura, intensidade e timbre como maneiras de descrever sons. Explicar que silêncio também ocupa tempo. Distinguir percepção e representação: uma imagem ajuda a comparar, mas não substitui a escuta.

**Som:** quatro comparações curtas, mudando uma característica por vez: som breve/longo; grave/agudo; suave/forte; mesma nota com dois timbres. Manter volume inicial moderado e evitar reprodução automática. A diferença de intensidade deve ser controlada sem exigir volume alto.

**Visual:** cartões comparativos e uma linha de tempo com blocos de som e espaço de silêncio. Não apresentar desenho de onda como se fosse uma partitura ou a única forma de reconhecer timbre.

**Prática:** ouvir dois exemplos, descrever o que mudou e revelar uma explicação. Repetir a sequência com uma pausa em outra posição e observar a mudança da sensação de continuidade.

**Revisão:** “Um som mais forte é necessariamente mais agudo?” e “Uma pausa deixa de fazer parte da música?”. Respostas comentadas: não; altura e intensidade são dimensões diferentes, e pausas organizam o tempo.

**Bardian:** relacionar ouvir/parar e observar eventos na tela. Não exigir criação de composição para concluir.

## Aula 5 — As notas têm nomes

**Resultado:** reconhecer Dó, Ré, Mi, Fá, Sol, Lá e Si e relacionar esses nomes às letras C, D, E, F, G, A e B.

**Desenvolvimento:** partir de sons com altura definida; explicar nome de nota e altura percebida. Apresentar o ciclo dos sete nomes, depois o mapeamento para letras usado na interface. Mostrar grupos de duas e três teclas pretas para localizar Dó. Explicar que teclas pretas também representam notas e que os sete nomes naturais não esgotam as alturas disponíveis; alterações serão aprofundadas adiante.

**Som:** notas naturais ascendentes e descendentes, tocadas individualmente; comparar duas notas com mesmo timbre e volume. Evitar sugerir que tocar apenas teclas brancas é uma regra de composição.

**Visual:** teclado de uma oitava com rótulos em português e letras, sem depender somente de cor. Destacar a tecla enquanto soa e deixar o nome legível quando o áudio está parado.

**Prática:** localizar Dó, ouvir Ré e Mi, construir a sequência Dó–Mi–Ré. Conferência revela nomes e ordem, não uma nota de aprovação.

**Revisão:** identificar C e G e explicar a diferença entre nome e intensidade. Usar exemplos variados, não apenas repetir a ordem decorada.

**Bardian:** reconhecer letras nos elementos musicais existentes. Não confundir a letra de uma nota com a descrição completa de um acorde.

## Aula 6 — Oitavas e registros

**Resultado:** perceber a repetição dos nomes em regiões graves e agudas e distinguir duas notas Dó em oitavas diferentes.

**Desenvolvimento:** ampliar o teclado; mostrar a repetição dos grupos de teclas e explicar registro. Apresentar oitava como relação musical entre alturas, usando a repetição do nome como apoio. Só então introduzir a numeração adotada no Bardian, verificando a convenção do domínio antes de publicar: diferentes programas podem usar números distintos para a mesma altura.

**Som:** Dó em duas oitavas, primeiro alternado e depois em sequência; repetir a mesma frase em dois registros, mantendo ritmo e timbre.

**Visual:** dois trechos de teclado e piano roll com eixo vertical identificado. Mostrar que subir na tela representa subir a altura, enquanto deslocar para a direita representa avançar no tempo.

**Prática:** comparar duas frases e indicar o que permaneceu e o que mudou. Ouvir uma terceira versão com volume diferente para separar registro de intensidade.

**Revisão:** “Dois Dós são sempre o mesmo som?” e “Mudar a oitava muda necessariamente o ritmo?”. Explicar nome compartilhado e alturas diferentes.

**Bardian:** conectar a posição vertical das notas à escuta, usando a representação musical já existente.

## Aula 7 — Minha primeira ideia musical

**Resultado:** ouvir, descrever e modificar uma frase curta combinando altura, duração e silêncio.

**Desenvolvimento:** retomar os conceitos sem acrescentar teoria harmônica formal. Construir dois compassos em 4/4: no primeiro, Dó, Ré, Mi e pausa, cada um com um pulso; no segundo, Mi por dois pulsos e Dó por dois pulsos. Explicar as escolhas como exemplo criativo, não como fórmula obrigatória.

**Som:** versão inicial, versão em outra oitava e versão com ritmo modificado. Oferecer reprodução integral e repetição manual; manter claros os parâmetros que mudaram.

**Visual:** teclado e grade da mesma frase, com correspondência entre rótulos, ordem e duração. Descrição textual completa disponível sem áudio.

**Prática:** escolher uma mudança de altura ou duração, prever o efeito, ouvir e comparar. Usar controles já consolidados; se edição embutida ainda não estiver pronta, publicar uma comparação guiada claramente identificada, sem controles simulados.

**Revisão:** descrever a frase com o próprio vocabulário, identificar uma pausa e explicar uma mudança. Conclusão encerra a aula pelo fluxo existente, sem inventar recompensa ou pontuação nova.

**Bardian:** preparar a ponte para intervalos, escalas e acordes, depois campo harmônico e composição de harmonias. Não antecipar toda essa matéria nesta taverna.

## Critérios para publicar cada aula

1. Texto completo revisado, com exemplos, aplicação e respostas explicadas.
2. Nomes, oitavas e durações conferidos contra o domínio musical existente.
3. Áudio iniciado apenas pelo usuário, com parada e tratamento de indisponibilidade.
4. Equivalente visual e textual para cada exemplo; controles utilizáveis por teclado.
5. Layout conferido em tela pequena e grande; movimento reduzido respeitado.
6. Links reais, leitura livre e conclusão individual preservados.
7. Testes de renderização, acesso e interações relevantes executados.
8. Publicar apenas o item pronto no catálogo e registrar a entrega no DevReport.

## Referências de preparação

- [Ableton Learning Music](https://learningmusic.ableton.com/): referência para experimentação acessível com sons, notas e ritmo.
- [Music Theory — Lessons](https://www.musictheory.net/lessons): referência de organização de fundamentos como duração, compassos, pausas e alturas.

A sequência acima é uma decisão pedagógica do Bardian, não uma ordem universal obrigatória. Os textos, exemplos e a narrativa serão autorais. Não reproduzir material das referências.
