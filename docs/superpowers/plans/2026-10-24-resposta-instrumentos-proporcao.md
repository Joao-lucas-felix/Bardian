# Resposta dos instrumentos e proporção dos ajustes

> Execução local autorizada pelo usuário em 24/10/2026. As alterações existentes no checkout devem ser preservadas.

**Objetivo:** reduzir a espera nas escutas repetidas e aproximar a página de ajustes da largura mostrada na captura.

**Abordagem:** o banco FluidR3 já permanece interpretado na sessão. Reutilizar as unidades de instrumento do grafo openDAW quando o timbre da faixa permanecer igual, substituindo apenas as regiões MIDI; conservar até duas unidades enquanto a página estiver aberta. Preparar a composição assim que um novo timbre for escolhido, sem iniciar a reprodução. Restringir somente o painel de ajustes a 780 px em telas largas.

**Alternativa descartada:** antecipar apenas o download do banco manteria o custo de recriação do grafo após cada edição. Manter uma unidade para cada um dos 15 timbres aumentaria a memória sem benefício proporcional.

**Limites:** não alterar a representação musical, persistência, catálogo ou dependências. A primeira leitura do banco e o primeiro preparo de cada timbre ainda têm custo. Preparações antigas não podem iniciar som nem sobrescrever a intenção atual.

## Etapa 1 — reutilização do motor

- [x] Escrever teste que falhe quando a mesma unidade é recriada após alteração de notas, ou quando uma faixa oculta na prévia volta sem sua unidade.
- [x] Executar o teste e confirmar a falha.
- [x] Reutilizar unidades por posição/timbre, substituir regiões e limitar o cache às duas faixas da composição.
- [x] Executar os testes de áudio e confirmar passagem.

## Etapa 2 — preparação na seleção

- [x] Escrever teste para preparação sem reprodução e para uma intenção cancelada pela troca seguinte.
- [x] Executar e confirmar falha.
- [x] Adicionar preparação ao transporte e dispará-la após escolha de timbre salvo, sem bloquear a interface.
- [x] Executar os testes JavaScript afetados.

## Etapa 3 — proporção e entrega

- [x] Ajustar o limite da página de ajustes para 780 px e preservar largura fluida em telas estreitas.
- [x] Verificar layout em desktop e largura estreita quando houver navegador disponível; executar build de áudio e testes afetados.
- [x] Revisar responsabilidades dos ERBs, registrar medições/limitações na documentação e entrega em `config/dev_reports.yml`.
