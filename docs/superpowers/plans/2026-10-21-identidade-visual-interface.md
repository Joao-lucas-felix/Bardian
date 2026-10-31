# Interface musical e sistema visual compartilhado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alternar a área principal da composição entre Harmonia, Ajustes e sugestões, e Piano roll pelo menu superior; dar mais espaço aos controles e alinhar as superfícies ativas à identidade verde-musical nos temas claro e escuro.

**Architecture:** O shell persistente da página mantém a composição musical e o estado Stimulus/Turbo, com a recuperação e os ajustes dentro do painel auxiliar existente. Tokens semânticos globais tornam-se a fonte compartilhada de cores e estados; `music_workspace.css` mantém apenas regras de composição específicas da área musical. O trabalho altera apresentação, sem modificar domínio, áudio, persistência ou rotas.

**Tech Stack:** Rails ERB, CSS, Hotwire Turbo Frames, Stimulus, Minitest, testes JavaScript existentes e verificação visual no navegador.

**Spec:** `docs/superpowers/specs/2026-10-21-identidade-visual-interface-design.md`

## Global Constraints

- Usar o mesmo painel principal para Harmonia, Ajustes e sugestões, e Piano roll; nenhuma dessas telas deve permanecer empilhada junto das outras.
- Manter ações de duração, reordenação e remoção do acorde selecionado fora da área substituída; ambas as faixas MIDI compartilham timbre/configuração.
- Manter recuperação, tonalidade/andamento e sugestões como ferramentas auxiliares; não salvar propostas ao abrir a página.
- Preservar temas claro e escuro, legibilidade, foco visível e controles de toque de pelo menos 44×44 CSS px.
- Usar rolagem vertical normal do documento; manter sequências extensas dentro das áreas roláveis locais. Dar respiro aos controles do seletor, menu superior e conta, sem reduzir alvos de toque.
- Aplicar a identidade às telas ativas: navegação/conta, autenticação, biblioteca, metadados, composição e harmonia. Excluir `app/legacy/`.
- Não alterar comportamento musical, áudio, dados persistidos, autorização, rotas ou dependências.
- Documentar em português o código novo ou alterado conforme aplicável; views não recebem consultas, autorização ou regras de domínio.
- Após verificação, registrar a entrega em `config/dev_reports.yml`.

## Review Focus

- Proposta de recuperação aberta após alternar os painéis: confirmar/descartar deve operar sobre o rascunho atual sem apagar seleção, cursor ou transporte.
- Resposta de Turbo Frame atrasada após troca rápida de painel: não deve substituir o painel mais recente nem reidratar controles obsoletos.
- Composição vazia ou em edição livre: o menu continua alternando uma área única e o seletor não infere acordes inexistentes.
- Viewport estreita/baixa e zoom de 100%: nenhuma visualização alarga a página; rolagens horizontais ficam locais à timeline/piano roll, e controles principais continuam acessíveis.
- Tema claro/escuro em telas ativas: foco, estados desabilitados, avisos e ações devem permanecer distinguíveis e legíveis.

---

### Task 1: Reorganizar a superfície principal de harmonia e os painéis auxiliares

**Files:**
- Modify: `app/views/harmony/show.html.erb`
- Modify: `app/views/harmony/_guided_panel.html.erb`
- Modify: `app/views/harmony/_settings_panel.html.erb`
- Modify: `app/views/harmony/_recovery.html.erb`
- Modify: `app/views/harmony/panel.html.erb`
- Modify: `app/javascript/controllers/harmony_controller.js`
- Test: `test/controllers/composition_harmonies_controller_test.rb`
- Test: arquivos de teste JavaScript existentes do controller Harmony, localizados antes da edição

**Interfaces:**
- O frame central alterna entre a sequência guiada (seletor e timeline), ajustes/sugestões e piano roll editável.
- O frame auxiliar existente continua atendendo `guided`, `settings` e `editor`; recovery e controles de tonalidade/sugestões são apresentados em `settings`.
- Dados de view seguem preparados pelo controller. A troca de painel não salva nem substitui o documento musical.

**Steps:**
- [ ] Localizar testes existentes de composição persistida, painéis Turbo e estado Harmony; identificar os seletores estáveis já disponíveis.
- [ ] Adicionar teste Rails que verifique que o menu troca a área inteira entre seletor/timeline, ajustes e piano roll, sem manter visualizações paralelas.
- [ ] Executar esse teste para verificar que a expectativa falha na estrutura atual.
- [ ] Adicionar cobertura para a presença de recuperação e controles auxiliares no painel `settings`, sem estes aparecerem como formulário extenso no fluxo principal.
- [ ] Atualizar testes JavaScript do controller para alternância/retorno de painel preservar documento, seleção e posição de reprodução, e para troca rápida não aplicar resposta antiga.
- [ ] Executar os testes novos e observar as falhas antes da implementação.
- [ ] Reorganizar a view e os partials para os três painéis usarem a mesma área e a recuperação permanecer em “Ajustes e sugestões”.
- [ ] Ajustar somente a coordenação Stimulus/Turbo necessária para manter o estado e reconectar os controles após o carregamento do frame.
- [ ] Executar testes Rails e JavaScript afetados; revisar os partials ERB para confirmar que continuam apenas apresentando dados preparados.

### Task 2: Unificar tokens e componentes visuais nas superfícies ativas

**Files:**
- Modify: `app/assets/stylesheets/productivity.css`
- Modify: `app/assets/stylesheets/music_workspace.css`
- Modify: `app/assets/stylesheets/harmony.css`
- Modify: `app/views/shared/_product_navigation.html.erb` apenas se o markup impedir o uso consistente dos tokens atuais
- Modify: `app/views/shared/_account_navigation.html.erb` apenas se necessário por estrutura visual ou foco
- Modify: `app/views/devise/sessions/new.html.erb` apenas se necessário por estrutura visual ou foco
- Modify: `app/views/devise/registrations/new.html.erb` apenas se necessário por estrutura visual ou foco
- Modify: `app/views/compositions/index.html.erb`, `app/views/compositions/show.html.erb`, `app/views/compositions/new.html.erb`, `app/views/compositions/edit.html.erb` e partials relacionados somente quando estrutura atual não aceitar os tokens

**Interfaces:**
- `productivity.css` define os papéis semânticos globais de fundo, superfície, texto, borda, acento, foco e estado.
- Os dois temas atribuem valores legíveis aos mesmos papéis; folhas específicas consomem esses tokens em vez de manter paletas paralelas.
- Componentes preservam nomes de classes, ações e conteúdo, salvo alteração de markup estritamente necessária para responsividade/acessibilidade.

**Steps:**
- [ ] Mapear declarações de cor, tipografia, botões, campos, foco e disclosures nas folhas e superfícies ativas; anotar regras duplicadas que hoje divergem.
- [ ] Registrar no plano de revisão os estados visuais que serão comparados (normal, hover, foco, selecionado, desabilitado, aviso) nos temas claro e escuro.
- [ ] Centralizar tokens semânticos em `productivity.css` e mapear os tokens de `music_workspace.css`/`harmony.css` sem alterar dimensões ou fluxo nesta tarefa.
- [ ] Aplicar os tokens comuns à navegação/conta, autenticação, biblioteca, metadados, composição e harmonia; preservar identidade e semântica de cada tela.
- [ ] Ajustar contraste, foco, área mínima de toque e adaptação a telas estreitas; evitar que regras antigas sobrescrevam os tokens em estados interativos.
- [ ] Executar `git diff --check`, testes Rails afetados e verificações de carregamento/compilação de assets disponíveis no projeto.

### Task 3: Tornar a composição responsiva, revisar visualmente e registrar entrega

**Files:**
- Modify: `app/assets/stylesheets/harmony.css`
- Modify: `app/assets/stylesheets/music_workspace.css`
- Modify: `app/views/harmony/show.html.erb` se a estrutura exigir wrapper semântico
- Modify: `app/views/harmony/_chord_wheel.html.erb`, `app/views/harmony/_lane.html.erb` e `app/views/harmony/_piano_roll.html.erb` apenas para ajustes de markup/semântica necessários
- Modify: `config/dev_reports.yml`

**Interfaces:**
- O fluxo principal usa rolagem vertical normal; timeline e piano roll mantêm rolagem horizontal local para sequências extensas.
- O acorde e o piano roll ocupam a largura disponível sem criar overflow lateral; a ordem dos controles/foco é igual em desktop e celular.
- O DevReport descreve apenas os comportamentos realmente concluídos e verificados.

**Steps:**
- [ ] Adicionar/ajustar assertions de view para menu e conteúdo substitutivo dos três painéis.
- [ ] Executar o teste Rails de ordenação e verificar resultado vermelho antes da mudança de markup/CSS pertinente, quando aplicável.
- [ ] Remover a altura rígida e o overflow aninhado da superfície de harmonia; construir adaptações para desktop, tablet, celular e viewport baixa sem alterar a ordem.
- [ ] Verificar manualmente no navegador harmonia, biblioteca, criação/edição e autenticação, nos temas claro e escuro, em desktop/tablet/celular e numa janela baixa.
- [ ] Verificar teclado/foco e toque: alternar os três painéis no menu, alternar tema, percorrer a timeline e usar os controles principais.
- [ ] Validar que a página não tem overflow horizontal, que timeline e piano roll mantêm rolagem local para sequências extensas, e que alternar visualização preserva duração, seleção, documento e reprodução.
- [ ] Revisar o diff de ERB quanto a consultas, autorização, lógica musical ou transformações complexas; ajustar apenas dentro do escopo aprovado.
- [ ] Executar suíte Rails afetada, testes JavaScript, `bin/rails zeitwerk:check`, `git diff --check` e as verificações de assets pertinentes; registrar limitações encontradas.
- [ ] Adicionar um relatório `identidade-visual-interface-musical` em `config/dev_reports.yml` com descrição, mudanças, data, tags e caminho de teste conferidos.

## Self-review

- **Cobertura:** estrutura e recuperação (Task 1); tokens e componentes globais (Task 2); responsividade, acessibilidade, validação e DevReport (Task 3). Escopo legado e alterações de domínio permanecem excluídos.
- **Granularidade:** cada tarefa gera uma mudança revisável. Os passos de teste são definidos antes das alterações correspondentes; verificação visual abrange temas, superfícies e viewports da especificação.
- **Consistência:** o painel auxiliar Turbo continua com os nomes `guided`, `settings` e `editor`; a ordem do fluxo principal é fixa no DOM, sem depender de CSS para reordenar foco.
- **Review focus:** os cinco casos no início são verificados na Task 1 (estado/transições) e Task 3 (responsividade/temas e navegação visual).
- **Proporção:** três tarefas cobrem a página e a atualização transversal, sem migração de arquitetura ou nova dependência. Os arquivos de view listados são condicionais a necessidade real de markup, para evitar refatoração ampla.
