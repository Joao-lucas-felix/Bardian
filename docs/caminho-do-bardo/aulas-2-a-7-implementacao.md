# Aulas 2 a 7 — implementação

Entrega de 29 de outubro de 2026, solicitada pelo autor para dar continuidade ao Caminho do Bardo.

## Responsabilidades e decisão técnica

- `config/bard_path_lessons.yml` libera as seis aulas após a existência de seus corpos completos.
- `lessons/_<slug>.html.erb` contém texto, prática guiada, aplicação no Bardian e revisão com respostas.
- `lessons/_examples.html.erb` apresenta cada comparação, a grade temporal e seus controles; não consulta conta nem decide regras musicais.
- `lessons/_keyboard.html.erb` mostra teclas nomeadas nas aulas de notas e oitavas.
- `BardPath::LessonExamples` concentra os eventos editoriais em tempos de pulso, sem criar outro formato de composição.
- `lesson_examples_controller.js` agenda os sons com Tone.js já instalado; começa somente por comando, interrompe ao parar, trocar de exemplo, ocultar a aba ou sair da página. O estado visual usa o instante de áudio como referência.

Foram considerados controladores independentes por aula e um reprodutor comum. O reprodutor comum foi escolhido para compartilhar cancelamento, falha de áudio e leitura visual, enquanto cada aula conserva exemplos e texto próprios. A alternativa de embutir eventos musicais extensos nas views foi descartada porque dificultaria a revisão das convenções musicais.

## Limites pedagógicos

Os exemplos são comparações finitas, não um novo editor nem alterações de composições salvas. O 3/4 demonstra agrupamento, enquanto o fluxo atual de composição permanece em 4/4. As letras e oitavas seguem a convenção documentada no domínio; outras aplicações podem numerar oitavas de outra forma. A frase da aula 7 é uma escolha criativa demonstrativa, não uma fórmula obrigatória.

## Verificação

Os testes Rails cobrem publicação, leitura livre, corpo, exemplos, teclado, catálogo, conclusão e demais regressões do projeto. Os testes JavaScript cobrem agendamento em tempos, silêncio entre eventos, parada durante preparação e falha de áudio. Em 29/10/2026: `195 runs, 1970 assertions, 0 failures` e 23 arquivos JavaScript sem falhas. `git diff --check` não apontou espaços inválidos.

Houve inspeção visual da aula de ritmo em tela estreita e da aula de notas em desktop. No navegador, um exemplo de ritmo iniciou após clique, atualizou o estado e terminou automaticamente; a largura da página não excedeu a viewport. Não houve escuta perceptiva do áudio nem inspeção visual individual das outras quatro aulas. Os testes comprovam o agendamento e a renderização HTTP, mas não substituem avaliação do som no dispositivo do autor.

## Correção de audibilidade em 30/10/2026

Após relato de que a aula 2 não emitia sons perceptíveis, a medição no navegador mostrou o contexto de áudio em execução, saída global sem mute e sinal da primeira nota em torno de −33 dB. O ganho nominal do sintetizador dos exemplos foi elevado de −14 dB para 0 dB; as velocidades dos eventos, usadas para comparações relativas de intensidade, permaneceram iguais. Uma nova medição da mesma nota indicou cerca de −20 dB. O teste JavaScript fixa o nível escolhido para evitar retorno silencioso ao valor anterior. A percepção final ainda depende do volume e da saída de áudio do dispositivo do estudante.

## Piano acústico nas aulas em 30/10/2026

Os exemplos das aulas 2 a 7 e a prática de pulsação da aula 1 passaram a utilizar o piano Salamander já empregado pelo editor, por meio de `createPhraseInstrument("piano")`. O controlador aguarda o carregamento da amostra local antes de agendar eventos, cancela uma preparação obsoleta ao parar ou sair da página e informa falhas de áudio. Um ganho local de quatro vezes compensa a atenuação do instrumento compartilhado sem alterar o volume do editor. A amostra A4 tem pico próximo de −10 dB no arquivo original; a intensidade final depende da velocidade do evento e da transposição. Somente a comparação didática de timbre da aula de escuta mantém uma onda senoidal, agora identificada no título e na legenda. A escolha preserva a comparação entre duas fontes sonoras na mesma nota. O piano usa uma única amostra transposta para as demais alturas, limitação já registrada em `docs/decisao-audio.md`.

Os testes dos dois controladores cobriram agendamento, ganho, carregamento, falha e cancelamento. Os testes Rails verificaram o conteúdo e a identificação dos instrumentos nas seis páginas: 196 testes e 1985 asserções sem falhas, com execução em um processo. Os 23 arquivos de testes JavaScript passaram. No navegador, a aula 2 e a prática de pulsação saíram do preparo para o estado de reprodução sem erros de console. Não houve avaliação perceptiva do timbre ou do volume no dispositivo do autor.
