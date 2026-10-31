# Caminho do Bardo — estrutura inicial

## Estado e propósito

Especificação da primeira etapa do Caminho do Bardo, aprovada em conversa em
22/10/2026 quanto à separação entre conteúdo versionado e progresso individual,
à leitura livre e ao contrato de rotas e conclusão. Este documento aguarda a
revisão final do autor antes do plano de implementação.

O Caminho do Bardo será uma jornada de aprendizagem musical ligada à conta.
Pessoas iniciantes poderão estudar conceitos musicais e seu uso no Bardian por
meio de aulas completas, com exemplos visuais e sonoros. A trilha mostrará o
avanço, mas não bloqueará a abertura de aulas publicadas. A produção do conteúdo
e o desenho visual serão etapas posteriores.

## Limite desta etapa

Entregar a estrutura capaz de listar aulas, abrir uma aula publicada e registrar
sua conclusão por usuário. A página da trilha pode usar apresentação básica nesta
etapa. A página de aula terá uma composição básica preparada para conteúdo,
exemplos e conclusão. A linguagem final, exercícios, recursos sonoros, pixel art,
recompensas e currículo detalhado não fazem parte desta implementação.

O primeiro conteúdo só será publicado depois das etapas de desenho da página e
preparação da aula. Enquanto não houver aula publicada, a trilha mostrará um
estado de preparação; não oferecerá uma conclusão fictícia. A estrutura de
catálogo será verificada com entradas de teste sem publicar texto incompleto no
produto.

## Fonte das aulas

Um catálogo versionado no projeto guarda, para cada aula, um `slug` estável,
título, resumo, ordem e estado de publicação. O conteúdo completo de cada aula
fica em um template próprio, também versionado. O catálogo é a fonte da ordem e
das aulas visíveis. A renderização não consulta o banco para obter texto.

`slug` é um identificador técnico: mudar o título não altera o progresso. Após
a publicação, alterar um `slug` exigirá uma migração explícita dos registros de
conclusão. O catálogo rejeita identificadores duplicados e não expõe aulas sem
conteúdo publicado. Uma aula retirada da publicação conserva as conclusões no
banco, mas deixa de aparecer como disponível até ser publicada novamente.

Não haverá painel administrativo nem banco de dados de conteúdo nesta etapa.
Isso mantém a escrita e revisão das aulas junto ao histórico do projeto.

## Progresso por usuário

`LessonCompletion` pertence a `User` e armazena `lesson_slug` e `completed_at`.
Uma chave estrangeira protege o vínculo com o usuário; um índice único em
`user_id` e `lesson_slug` impede duplicação mesmo em requisições concorrentes.
Ao excluir uma conta, as conclusões correspondentes também são removidas.

Concluir é uma ação manual. Repetir a ação mantém o registro existente e sua
data original. Apenas aulas publicadas e presentes no catálogo podem ser
concluídas. O controller sempre opera sobre a associação de `current_user`; o
cliente não escolhe `user_id`. O progresso exibido é derivado das conclusões
relacionadas a aulas atualmente publicadas. Não há contador de pontos, nível ou
posição gravados separadamente.

## Rotas e respostas

Todas as rotas exigem autenticação Devise:

| Método | Caminho | Responsabilidade |
| --- | --- | --- |
| `GET` | `/caminho-do-bardo` | Lista aulas publicadas e o progresso do usuário. |
| `GET` | `/caminho-do-bardo/:slug` | Mostra uma aula publicada. |
| `POST` | `/caminho-do-bardo/:slug/conclusao` | Registra a conclusão e volta à aula com confirmação. |

Um `slug` ausente, desconhecido ou ainda não publicado responde com 404 nas
rotas de aula e conclusão. Reenviar a conclusão não cria novo registro. A ação
de conclusão usa a proteção CSRF padrão do Rails. Não há rota de edição de
conteúdo ou de remoção de conclusão neste incremento.

## Páginas e responsabilidades

A página principal da trilha apresenta a estrutura e, quando houver aulas
publicadas, o título, resumo, ordem e estado de conclusão de cada uma. Uma aula
publicada pode ser aberta em qualquer ordem. Na ausência de aulas publicadas,
mostra um estado de preparação sem simular progresso.

A página da aula apresenta navegação de retorno, título, conteúdo próprio,
estado de conclusão e ação de concluir. A view principal explicita essa ordem.
Conteúdo e futuros exemplos de responsabilidade própria serão divididos em
partials conforme sua extensão, com dados preparados pelo controller. Views não
consultam o banco, autorizam ações nem calculam regras de progresso.

O controller coordena autenticação, consulta ao catálogo, leitura das conclusões
do usuário e resposta HTTP. O catálogo resolve metadados e publicação; o modelo
persistente representa a conclusão. A navegação global recebe um link para a
trilha, sem trocar a rota inicial atual da biblioteca de composições.

## Gamificação nesta etapa

A ordem do catálogo e as conclusões individuais já fornecem os estados de uma
trilha: aula disponível, aula concluída e sugestão de próxima aula incompleta.
Todas as aulas publicadas continuam acessíveis. A aparência em pixel art,
marcos, recompensas e eventual regra de pontos serão decididos no desenho do
frontend, sem exigir outra tabela agora.

## Verificação

Antes dos testes, será explicado ao autor que cada caso verifica o vínculo entre
conta e progresso, a leitura livre ou a rejeição de uma aula não publicada.
Testes de modelo e integração cobrirão:

- unicidade da conclusão e preservação de `completed_at` após repetição;
- acesso de usuários diferentes à mesma aula sem compartilhar conclusão;
- abertura de qualquer aula publicada, independentemente da ordem;
- 404 para identificador desconhecido ou aula ainda não publicada;
- exigência de login nas três rotas;
- renderização da trilha vazia e da aula publicada com entradas de teste;
- remoção das conclusões quando a conta for excluída.

Após implementar, revisar as responsabilidades das views e partials, executar os
testes afetados e conferir as rotas no navegador. Uma entrega verificada terá
registro em `config/dev_reports.yml` com link interno para a trilha.

## Sequência após esta etapa

1. Definir o frontend da trilha e de uma página de aula, incluindo a função da
   pixel art, legibilidade, responsividade e acessibilidade.
2. Preparar a estrutura didática da primeira aula e sua sequência curricular.
3. Escrever, implementar e verificar as aulas uma a uma, começando pelos
   conceitos simples e avançando até harmonia e uso da composição do Bardian.

Cada etapa posterior terá escopo e verificação próprios. Recursos sonoros devem
reutilizar a infraestrutura existente quando adequada; qualquer nova dependência
ou mudança estrutural será discutida antes de ser adotada.
