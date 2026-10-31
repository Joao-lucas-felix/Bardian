# Composições e harmonia persistida

Escopo autorizado: reconstruir a entrada de criação, preservar o editor anterior
como referência, organizar composições com nome/capa opcional e salvar harmonia
por composição. Integrar openDAW nessa harmonia; revisar o visual somente depois
da etapa técnica, limitado às páginas de composições e harmonia.

## Decisões e responsabilidades

- O JSON musical continua sendo a fonte de verdade. A harmonia guiada edita uma
  faixa identificada deterministicamente, sem substituir outras faixas.
- Capas usam Active Storage (já incluído no Rails), JPEG/PNG/WebP até 5 MB,
  servidas por rota autenticada. A migração apenas acrescenta tabelas.
- `CompositionsController` gerencia biblioteca, metadados e editor de referência;
  `CompositionHarmoniesController` autoriza análise e salvamento por proprietário.
- `CompositionHarmony` projeta/mescla a faixa guiada; mantém notas alheias e exige
  controle de versão. A primeira versão guiada suporta 4/4 e até 32 tríades.
- O SDK openDAW 0.0.174 é empacotado com Vite separadamente do Importmap; binários
  locais e COOP/COEP ficam limitados à harmonia. Navegação dessas páginas usa
  carregamento completo para estabelecer corretamente o isolamento.
- Um sintetizador interno executa a harmonia. Não se promete piano acústico,
  equivalência de instrumentos legados ou migração da DAW antiga nesta entrega.

## Ordem e verificações

1. Biblioteca, capa, página da música e rota de referência; testar autorização,
   validação de upload, busca, preservação de documentos e conflitos.
2. Projeção/salvamento da harmonia; testar reabertura, preservação de outras
   faixas, documentos inválidos e concorrência.
3. Adaptador openDAW; verificar conversão 480→960 PPQN, notas, BPM, ciclo de vida,
   cancelamento durante carregamento e áudio real no navegador.
4. Revisão visual: biblioteca em linhas, cabeçalho enxuto, ações principais
   evidentes, configurações e teoria recolhidas; acordes em seletor legível.
5. Testes de regressão, inspeção desktop/mobile, documentação e DevReport.

## Views

`index`: cabeçalho/busca e lista; `_composition_row` recebe composição.
`new`/`edit`: `_metadata_form` recebe composição e URL, sem regras musicais.
`show`: capa/nome e escolha entre harmonia e editor avançado de referência.
`legacy`: preserva a view anterior e seus partials.
`harmony/show`: cabeçalho/salvar, seletor de acordes, sequência, sugestões e
configurações. Recebe documento projetado/estado do controller; não consulta banco.

## Limites

Não há reorganização global do site, pastas, compartilhamento, autosave, efeitos
ou substituição do áudio legado. Capas são privadas por rota de proprietário.
A avaliação auditiva do autor e a revisão jurídica para publicação continuam
separadas dos testes técnicos. O build distribuído requer npm ci + npm run build:audio.
# Complemento autorizado em 19/10/2026

Seguir o diagrama do autor: acordes em arco sobre timeline horizontal com rolagem
e reordenação. Controles de reprodução pertencem ao cabeçalho da timeline;
Antes/Depois/Remover aparecem na seleção. Piano roll recolhido e somente de
leitura nesta etapa, sem introduzir edição livre incompatível com tríades por tempo.
Verificar preservação de IDs e alturas, ordem salva, teclado, arrasto e overflow.
