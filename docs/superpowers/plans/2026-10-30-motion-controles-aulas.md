# Motion dos controles de áudio das aulas

**Objetivo:** fazer o Play virar um violão SVG que se monta enquanto o áudio carrega e vibra enquanto toca.

**Escopo autorizado:** exemplos sonoros e prática de pulsação do Caminho do Bardo. Preservar rótulos, conteúdo, paleta, ações de áudio e modo sem som. Sem dependências novas.

**Estrutura:** um partial SVG compartilhado pelas duas views; CSS da trilha controla o desenho por `data-audio-state`; cada controlador Stimulus publica `idle`, `loading`, `playing` ou `silent` conforme o estado real.

**Verificação:** testes de transições, falha e cancelamento nos controladores; teste de renderização das duas views; inspeção de movimento reduzido, responsividade e foco.

- [x] Acrescentar testes dos estados e verificar falha inicial.
- [x] Implementar estados nos controladores e verificar os testes.
- [x] Criar SVG compartilhado e estilos dos estados, preservando texto acessível.
- [x] Verificar renderização e registrar a entrega em `config/dev_reports.yml`.
