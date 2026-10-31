# Caminho do Bardo: selecionar, caminhar e descobrir

## Pedido e resultado esperado

A primeira aula explica tempos de forma simples. O mapa apresenta um único personagem, inicialmente numa estrada vazia antes da primeira taverna. No retorno, ele aparece na última aula visitada. Selecionar o círculo da estrada faz o bardo caminhar até a taverna, entrar e revelar um pequeno resumo. Um botão no resumo abre a aula; visitar não conclui a aula.

## Fluxo proposto

1. Sem visita anterior: estrada de entrada no topo do mapa, sem construção, com o personagem parado.
2. Com visita anterior válida: personagem junto à entrada da taverna e enquadramento nessa parada, sem repetir a caminhada automaticamente.
3. Cada parada tem um círculo selecionável na estrada, título acessível e estado de conclusão textual.
4. Seleção: esconder o resumo anterior; percorrer a estrada desde a posição atual até a parada escolhida; seguir o acesso até a porta; ocultar o personagem ao entrar.
5. Chegada: mostrar título e resumo, botão “Entrar na aula” e ação de fechar. Mover o foco para o resumo sem provocar navegação automática.
6. Fechar: voltar o foco ao seletor; o bardo reaparece na entrada. Outra seleção começa nessa posição.
7. Movimento reduzido: chegar e abrir o resumo imediatamente. Teclado deve oferecer o mesmo fluxo.
8. Uma aula concluída continua visitável, e nenhuma parada exige concluir a anterior.

## Decisão aprovada: última visita

Recomendação apresentada: guardar o slug da última taverna visitada na conta, separado de lesson_completions. A visita acontece ao revelar o resumo após a chegada. A gravação deve ser autenticada, aceitar apenas aula publicada e nunca receber um identificador de outro usuário. Uma visita indisponível no catálogo volta ao início do mapa.

Alternativa: armazenamento local com chave individualizada por conta; não acompanha o usuário em outros dispositivos. O usuário foi consultado porque o AGENTS.md exige discutir mudanças de persistência. O usuário aprovou persistência na conta. Implementado como users.last_bard_lesson_slug, gravado por POST autenticado para aulas publicadas.

Uma falha ao salvar não deve impedir a leitura: informar que a posição não foi salva e manter o resumo utilizável.

## Organização da interface

- index: cabeçalho, progresso e mapa; recebe do controller aulas publicadas e posição inicial validada.
- partial de entrada: estrada vazia no começo, sem uma taverna fictícia.
- partial de parada: cenário, acesso à porta e seletor circular; recebe aula, número e conclusão.
- partial de viajante: um único SVG sobre o mapa, não uma cópia em cada parada.
- partial de resumo: título, explicação curta e link real da aula; dados vêm do catálogo.
- controller Stimulus do mapa: posição, caminho, foco, seleção e animação cancelável. Não calcula progresso ou conteúdo musical.
- CSS/SVG: preservam a estética pixel art e a rolagem vertical; coordenadas precisam acompanhar recortes e tamanhos responsivos.

A rota de leitura existente permanece. Uma eventual rota POST de visita só será adicionada se a persistência na conta for escolhida. Sem JavaScript, oferecer links normais para as aulas; não deixar seletores inertes como único acesso.

## Primeira aula e escopo editorial

Título: Sentindo os tempos da música.
Resumo: Descubra como acompanhar a batida de uma música e perceber os tempos, mesmo sem saber tocar um instrumento.

Começar por passos regulares e contagem; apresentar pulsação e comparar andamentos; depois introduzir BPM. Explicar que contar até quatro é o exemplo da atividade, não uma característica de toda música. Preparar comparação sonora e indicação visual equivalente. O roteiro editorial foi reordenado para tempos, duração/ritmo, compassos, escuta, notas, oitavas e primeira ideia musical.

Nesta etapa, definir a estrutura e o resumo não significa publicar uma aula curta como se estivesse completa. O catálogo atual está vazio: a publicação deve ocorrer com a primeira aula desenvolvida e seus exemplos, conforme o processo já combinado.

## Verificação prevista

- Uma única instância do personagem, início vazio e restauração de visita válida.
- Caminhada entre paradas em ambas as direções; entrada antes do resumo.
- Cliques rápidos não deixam animações ou gravações concorrentes fora de ordem.
- Movimento reduzido, teclado, foco ao abrir/fechar e links sem JavaScript.
- Progresso permanece inalterado ao visitar; isolamento entre contas se persistido no servidor.
- Slug removido/desconhecido e falha de gravação recebem tratamento explícito.
- Renderização Rails e testes de estado/interação JavaScript; inspeção visual em desktop e celular quando houver navegador disponível.

## Limites

Sem novas bibliotecas, inventário, combate, recompensas adicionais ou agrupamento persistente de tavernas. O resumo não exige mudar a estrutura de domínio musical. Implementados mapa superior compacto conforme a nova referência, seletores, resumo e persistência. A prévia editorial não grava visita por ainda não ser aula publicada. Validação visual em navegador permanece pendente.

## Correção visual solicitada pelo usuário

O esquema de linhas define somente o trajeto e as interações. O cenário deve preservar a arte de jogo anterior: gramado, árvores, cercas, taverna com bandeira e estrada de terra. O fundo vazio e a representação esquemática foram substituídos pela arte original reorganizada. As imagens compartilham um espaço de 400 × 240 com o trajeto; o controller converte coordenadas para o tamanho renderizado. A persistência da visita e a separação da conclusão permanecem iguais.
