# Aula 1 — Sentindo os tempos da música

Entrega de 25 de outubro de 2026, autorizada pelo usuário.

## Responsabilidades

- `lessons/_tempos.html.erb`: texto autoral em sete seções, prática guiada, tabela de comparação e revisão com respostas expansíveis.
- `lessons/_pulse_practice.html.erb`: controles e contagem de uma experiência independente. Não consulta conta nem cria progresso.
- `lesson_pulse_controller.js`: oito tempos, 60/90/120 BPM, subdivisão binária opcional, início manual, interrupção e limpeza. Reutiliza Tone.js já instalado; não altera o transporte global, composições ou domínio musical.
- Catálogo: publica somente `tempos`. Conclusão e visita usam as rotas autenticadas existentes.

## Decisões pedagógicas

Quatro números repetidos duas vezes são a convenção do exercício, não uma regra universal. A subdivisão duplica eventos mantendo o pulso indicado. Todos os cliques usam o mesmo timbre e volume para não confundir mudança de andamento com mudança de intensidade. Não há avaliação obrigatória ou bloqueio de leitura.

## Verificação e limites

Testes do controller verificam intervalo entre eventos, quantidade e duração da subdivisão, modo silencioso, falha de áudio, cancelamento durante preparação e compensação da antecedência do relógio Tone. Testes HTTP usam a aula real, conclusão por conta e bloqueio das prévias não publicadas.

O visual usa estados estáticos, sem animações de escala, deslocamento ou loops decorativos. A contagem em tempo real não é uma região viva para evitar anúncios contínuos; início, término e falha têm mensagens acessíveis. O texto oferece uma experiência alternativa sem interação.

Sincronização na saída física de áudio pode variar com o dispositivo; inspeção visual e escuta no navegador não foram realizadas nesta entrega. Os testes verificam agendamento e fluxo, não qualidade auditiva percebida.
