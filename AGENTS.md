# AGENTS.md

## 1. Propósito deste documento

Este documento define as regras de atuação de agentes de IA no desenvolvimento do Trabalho de Conclusão de Curso.

O projeto possui finalidade acadêmica, de pesquisa, aprendizagem e desenvolvimento de software. Portanto, o objetivo dos agentes não é simplesmente produzir código rapidamente, mas colaborar com o desenvolvimento de forma que o autor do projeto compreenda as decisões, participe da implementação e mantenha controle sobre a evolução do sistema.

As instruções deste documento devem ser tratadas como restrições operacionais do projeto.

---

# 2. Princípio central de colaboração

O agente deve atuar como orientador técnico e parceiro de implementação, não como substituto do desenvolvedor.

O processo de desenvolvimento deve priorizar:

1. compreensão antes da implementação;
2. mudanças pequenas e verificáveis;
3. participação ativa do usuário;
4. decisões explícitas;
5. explicação das alternativas relevantes;
6. rastreabilidade das decisões;
7. testes e validação incremental;
8. simplicidade antes de abstrações;
9. preservação do escopo acadêmico;
10. aprendizado durante o desenvolvimento.

Sempre que houver conflito entre velocidade de implementação e compreensão do projeto, deve-se priorizar a compreensão.

---

# 3. Papel do usuário na implementação

O usuário pode implementar pessoalmente ou autorizar o agente a implementar. Sua participação deve ocorrer pela compreensão das decisões e do estado do projeto, sem obrigação de escrever o código manualmente.

Como o prazo de finalização do projeto está se aproximando, o trabalho pode avançar em passos maiores, desde que cada passo tenha escopo explícito, objetivo verificável e relação clara com as prioridades do TCC.

Antes de iniciar uma etapa maior, o agente deve:

1. apresentar o objetivo, o escopo e os arquivos ou módulos potencialmente afetados;
2. explicar a responsabilidade, o funcionamento e o motivo da alteração;
3. indicar as decisões relevantes, as alternativas e os riscos de escopo;
4. explicar como verificar o comportamento, incluindo os testes propostos;
5. informar o início da execução e manter o usuário atualizado durante a etapa;
6. revisar o resultado e registrar limitações ou decisões importantes.

A autorização do usuário para uma etapa vale para todo o escopo apresentado, incluindo implementação, testes, correções necessárias dentro desse escopo e ajustes documentais relacionados. Não é necessário pedir nova autorização para cada pequeno incremento contido na etapa.

Se surgir uma mudança fora do escopo autorizado, especialmente uma alteração estrutural, uma nova dependência, uma mudança de arquitetura ou uma expansão relevante do produto, o agente deve interromper essa parte, explicá-la e solicitar nova decisão.

Mensagens como "vamos seguir" ou "continuar" autorizam o prosseguimento da etapa já delimitada quando houver uma autorização explícita anterior para ela. Fora desse caso, devem ser interpretadas como pedido de apresentação do próximo passo.

O agente deve preferir:

- explicar o problema;
- apresentar uma abordagem;
- discutir alternativas;
- indicar o arquivo, classe, função ou módulo a ser trabalhado;
- apresentar pequenos exemplos;
- explicar sintaxe e fluxo;
- orientar a escrita do código;
- revisar o código escrito pelo usuário;
- sugerir correções;
- propor testes;
- interpretar os resultados junto com o usuário.

O agente não deve transformar automaticamente uma discussão em uma grande implementação pronta.

O agente pode apresentar código completo para o pequeno incremento em discussão, acompanhado de explicações. Para aplicá-lo ao projeto, deve seguir a consulta prévia acima, inclusive em correções, testes, refatorações e tarefas repetitivas ou mecânicas.

---

# 4. Regra de implementação por etapas

Novas funcionalidades devem ser desenvolvidas em etapas delimitadas. Na reta final do projeto, uma etapa pode atravessar múltiplas camadas quando isso for necessário para entregar um fluxo demonstrável e reduzir o risco de não conclusão.

Cada etapa deve declarar:

- o resultado esperado;
- as partes do sistema envolvidas;
- as decisões que permanecem abertas;
- os testes ou verificações previstos;
- as limitações que não serão resolvidas naquela etapa.

As unidades menores continuam sendo úteis para organizar o trabalho, mas não exigem aprovação individual quando estiverem dentro de uma etapa previamente autorizada.

O fluxo preferencial é:

```text
entender o problema
        ↓
delimitar a responsabilidade
        ↓
discutir alternativas
        ↓
definir a próxima etapa concluível
        ↓
apresentar escopo, código ou plano técnico e explicar como verificar
        ↓
obter autorização para a etapa quando ela ainda não estiver autorizada
        ↓
agente implementa a etapa autorizada ou usuário implementa, se preferir
        ↓
agente revisa o conjunto da etapa
        ↓
testar
        ↓
interpretar o resultado
        ↓
registrar decisões importantes
        ↓
seguir para o próximo passo
```

---

# 5. Comunicação durante o desenvolvimento

O agente deve manter o usuário informado sobre cada etapa relevante.

Antes de sugerir uma implementação, deve explicar:

1. qual problema está sendo resolvido;
2. por que aquele problema deve ser resolvido agora;
3. qual parte do projeto será afetada;
4. qual será a responsabilidade do trecho;
5. quais entradas e saídas são esperadas;
6. quais decisões precisam ser tomadas;
7. quais alternativas relevantes existem;
8. como verificar se a implementação funcionou.

Durante uma tarefa maior, o agente não deve desaparecer e retornar apenas com o resultado final.

O desenvolvimento deve ser acompanhado passo a passo.

---

# 6. Decisões que não podem ser tomadas silenciosamente

O agente não deve escolher automaticamente decisões estruturais importantes.

Devem ser discutidas previamente decisões como:

- linguagem;
- framework;
- biblioteca principal;
- banco de dados;
- mecanismo de persistência;
- arquitetura geral;
- organização de módulos;
- formato de comunicação entre partes do sistema;
- estratégia de autenticação;
- formato de armazenamento musical;
- ferramenta de renderização;
- protocolo de áudio;
- biblioteca de notação;
- mecanismo de jobs;
- infraestrutura;
- modelo de deploy;
- ferramentas de visualização;
- abordagem para análise de áudio.

O agente pode apresentar opções, vantagens, limitações e impactos, mas a escolha deve permanecer com o usuário.

---

# 7. Escopo geral do projeto

O projeto consiste na evolução de uma aplicação de geração musical algorítmica para uma plataforma de criação e aprendizagem musical assistida.

O público principal são pessoas com pouco ou nenhum conhecimento de teoria musical.

O objetivo é reduzir a barreira de entrada para composição musical, permitindo que o usuário:

```text
crie
  ↓
visualize
  ↓
ouça
  ↓
compreenda
  ↓
modifique
  ↓
ouça novamente
```

Criação e aprendizagem devem fazer parte do mesmo ambiente.

A geração automática deve permanecer disponível, mas não deve ser a única forma de interação.

O usuário deve participar diretamente da construção musical.

---

# 8. Princípio estrutural do domínio

A representação musical estruturada deve funcionar como base comum do sistema.

Conceitualmente:

```text
Representação musical
        │
        ├── geração
        ├── edição
        ├── visualização
        ├── contextualização teórica
        ├── reprodução
        └── renderização
```

Essa representação deve ser independente da tecnologia utilizada para produzir áudio.

O domínio musical não deve depender diretamente de detalhes de interface, síntese ou infraestrutura.

---

# 9. Escopo — Fundamentos musicais

A primeira parte do projeto deve consolidar a representação dos principais conceitos musicais.

O núcleo deve contemplar progressivamente:

1. notas;
2. alturas;
3. oitavas;
4. acidentes;
5. intervalos;
6. escalas;
7. acordes;
8. tonalidades;
9. campos harmônicos;
10. graus;
11. progressões harmônicas.

Esses conceitos devem formar uma base coerente e reutilizável.

As dependências conceituais devem ser respeitadas.

Exemplo:

```text
Notas
  ↓
Intervalos
  ↓
Escalas
  ↓
Acordes
  ↓
Tonalidades
  ↓
Campos harmônicos
  ↓
Graus
  ↓
Progressões
```

Essa ordem pode ser ajustada quando houver justificativa conceitual, mas não deve ser alterada silenciosamente pelo agente.

---

# 10. Representação de notas

O projeto deve permitir representar musicalmente notas de maneira suficiente para sustentar as demais estruturas.

Devem ser consideradas, conforme a evolução do domínio:

- nome da nota;
- altura;
- oitava;
- acidentes;
- equivalências quando relevantes;
- representação adequada para uso musical;
- conversão para estruturas necessárias à reprodução.

A representação interna deve ser discutida antes de ser fixada.

---

# 11. Intervalos

O sistema deve ser capaz de representar e identificar relações intervalares entre notas.

O agente deve tratar intervalos como parte do domínio musical, e não apenas como diferença numérica entre alturas.

Quando a implementação exigir decisões como:

- classificação;
- direção;
- qualidade;
- equivalência;
- representação cromática;
- representação diatônica;

essas decisões devem ser apresentadas ao usuário antes da implementação.

---

# 12. Escalas

O projeto deve permitir representar escalas e suas notas.

Escalas devem se relacionar com:

- notas;
- intervalos;
- tonalidades;
- acordes;
- graus;
- contexto harmônico.

O agente não deve limitar antecipadamente o sistema a um único conjunto de escalas sem que isso seja uma decisão explícita de escopo.

---

# 13. Acordes

O projeto deve representar acordes e permitir identificar as notas que os compõem.

Quando aplicável, a representação poderá evoluir para contemplar:

- formação;
- qualidade;
- extensões;
- alterações;
- inversões;
- baixo;
- voicing.

Esses recursos não devem ser implementados automaticamente apenas porque são possíveis.

O desenvolvimento deve respeitar as necessidades do escopo atual.

---

# 14. Tonalidades

O sistema deve representar tonalidades e suas relações com:

- escalas;
- acordes;
- graus;
- progressões;
- contexto harmônico.

A tonalidade deve funcionar como parte importante da contextualização teórica da composição.

---

# 15. Campos harmônicos

O sistema deve ser capaz de construir e representar campos harmônicos a partir do contexto tonal.

O campo harmônico deve ser derivado da base musical estruturada, evitando regras duplicadas em diferentes partes do sistema.

---

# 16. Graus

O projeto deve relacionar acordes aos respectivos graus dentro de um contexto musical.

O sistema deve permitir que essa informação seja utilizada posteriormente para:

- explicações;
- visualizações;
- edição;
- progressões;
- sugestões musicais.

---

# 17. Progressões harmônicas

O sistema deve representar sequências de acordes como progressões harmônicas.

Progressões devem poder ser utilizadas tanto pela geração automática quanto pela edição realizada pelo usuário.

A representação deve permitir compreender a progressão em termos de:

- acordes;
- graus;
- tonalidade;
- ordem temporal;
- estrutura da composição.

---

# 18. Escopo — Composição e edição

Após a consolidação dos fundamentos, o projeto deve permitir criação e edição direta de elementos da composição.

O escopo inclui:

- criar notas;
- remover notas;
- modificar notas;
- criar melodias;
- editar melodias;
- criar acordes;
- modificar acordes;
- editar progressões;
- manipular linhas de baixo;
- manipular padrões rítmicos;
- manipular faixas individualmente;
- organizar elementos no tempo.

A edição deve operar sobre a representação musical estruturada.

---

# 19. Estrutura da composição

A composição deve possuir uma representação independente de sua renderização sonora.

Conceitualmente:

```text
Composição
    │
    ├── estrutura temporal
    ├── faixas
    │     ├── acordes
    │     ├── melodia
    │     ├── baixo
    │     └── ritmo
    │
    └── contexto musical
```

O formato concreto dessa representação deve ser definido durante o desenvolvimento.

---

# 20. Faixas

O usuário deve poder trabalhar com partes da composição separadamente.

A plataforma deve permitir, conforme o escopo da etapa:

- visualizar faixas;
- selecionar faixas;
- editar faixas;
- reproduzir faixas isoladamente;
- reproduzir a composição completa;
- associar elementos musicais às faixas.

A arquitetura concreta para representação das faixas deve ser discutida antes da implementação.

---

# 21. Escopo — Aprendizagem musical

A plataforma deve explicar ao usuário os elementos musicais presentes na composição.

A aprendizagem não deve funcionar como módulo completamente separado da criação.

Ela deve utilizar o contexto real da composição.

Por exemplo, ao selecionar um acorde, a plataforma poderá explicar:

- quais notas o formam;
- quais intervalos estão presentes;
- qual é sua função no contexto atual;
- a qual grau pertence;
- sua relação com a tonalidade;
- sua relação com os acordes próximos.

O mesmo princípio deve se aplicar a:

- notas;
- intervalos;
- escalas;
- acordes;
- tonalidades;
- campos harmônicos;
- graus;
- progressões.

---

# 22. Assistência à criação

As relações musicais conhecidas pelo sistema poderão ser utilizadas para auxiliar o usuário durante a composição.

Essa assistência poderá incluir:

- contextualização;
- sugestões;
- identificação de relações;
- explicação de alternativas;
- visualização de possibilidades.

A ferramenta não deve obrigar o usuário a seguir uma única regra musical.

Sugestões devem ser apresentadas como auxílio à criação, não como decisões obrigatórias.

---

# 23. Visualização musical

O projeto deve permitir visualizar relações musicais de forma progressivamente mais clara.

Entre as possibilidades previstas estão:

- notas;
- acordes;
- escalas;
- graus;
- tonalidades;
- progressões;
- relações harmônicas;
- estrutura temporal;
- piano roll;
- notação musical, caso viável.

Visualizações avançadas não precisam fazer parte da primeira versão.

---

# 24. Escopo — Reprodução

O usuário deve poder ouvir o resultado durante o processo de criação.

O sistema deve permitir:

- reprodução da composição;
- reprodução isolada por faixa;
- atualização da reprodução após alterações;
- transformação da representação musical em eventos reproduzíveis.

A implementação deve preservar uma separação clara entre representação musical e reprodução.

---

# 25. Escopo — Renderização

A composição deve poder ser transformada em áudio.

A renderização deverá utilizar a estrutura musical produzida pelo sistema.

Conceitualmente:

```text
representação musical
        ↓
eventos musicais
        ↓
renderização
        ↓
áudio
```

Detalhes tecnológicos desse processo serão definidos posteriormente.

---

# 26. Instrumentos e fontes sonoras

O sistema deverá permitir, progressivamente, selecionar formas de execução sonora para as faixas.

O agente não deve assumir uma implementação específica para:

- instrumentos;
- sintetizadores;
- fontes sonoras;
- samplers;
- bancos de timbres;
- plugins.

A abstração necessária será definida conforme os experimentos do projeto.

---

# 27. Produção sonora

Recursos de produção sonora fazem parte da evolução do projeto, mas não possuem prioridade sobre o núcleo musical.

Podem ser considerados:

- volume por faixa;
- mixer;
- equalização;
- compressão;
- reverberação;
- delay;
- processamento por faixa;
- exportação.

Esses recursos devem ser tratados como secundários enquanto a representação, edição, aprendizagem e reprodução ainda não estiverem consolidadas.

---

# 28. Exportação

A plataforma deve permitir exportar os resultados produzidos.

Os formatos suportados serão definidos durante o desenvolvimento.

Não assumir antecipadamente quais formatos serão obrigatórios além daqueles necessários para validar cada fase do projeto.

---

# 29. Estudos de viabilidade

Algumas funcionalidades devem ser tratadas como experimentais.

Elas não pertencem automaticamente ao núcleo obrigatório do sistema.

O objetivo de um estudo de viabilidade é responder se determinada funcionalidade:

- pode ser implementada com qualidade aceitável;
- possui custo compatível com o TCC;
- gera resultados úteis;
- possui complexidade justificável;
- deve ou não ser incorporada ao projeto.

Um protótipo experimental não deve ser transformado automaticamente em requisito definitivo.

---

# 30. Análise de áudio

Um dos estudos de viabilidade poderá investigar a análise de arquivos de áudio.

Entre os elementos passíveis de investigação estão:

- BPM;
- pulsação;
- tonalidade;
- escala provável;
- acordes;
- progressões;
- campo harmônico;
- seções;
- padrões musicais.

Essa funcionalidade poderá envolver técnicas de processamento de sinais e recuperação de informação musical.

O agente deve separar claramente:

```text
funcionalidade consolidada
```

de:

```text
hipótese experimental
```

Resultados experimentais devem ser apresentados com suas limitações.

---

# 31. MIDI e notação

Outro estudo poderá investigar relações entre representação musical, MIDI e notação convencional.

Podem ser estudados:

- representação estruturada para MIDI;
- MIDI para notação;
- notação estruturada para representação interna;
- representação interna para notação.

Reconhecimento de partituras a partir de imagens ou documentos deve ser tratado como problema separado.

---

# 32. Prioridades do projeto

As prioridades atuais são:

## Essencial

- representação musical;
- edição;
- reprodução;
- contextualização educacional;
- renderização.

## Secundário

- mixer;
- efeitos;
- visualizações avançadas;
- ferramentas adicionais de produção;
- partitura, caso seja viável.

## Experimental

- análise de áudio;
- transcrição de áudio;
- funcionalidades derivadas de estudos de viabilidade.

As prioridades podem ser revistas pelo usuário conforme evolução do projeto e prazo do TCC.

---

# 33. Fases conceituais

O projeto deve evoluir incrementalmente.

## Fase 1 — Fundamentos musicais

Consolidar:

- notas;
- intervalos;
- escalas;
- acordes;
- tonalidades;
- campos harmônicos;
- graus;
- progressões.

## Fase 2 — Composição

Desenvolver progressivamente:

- edição de notas;
- edição de melodias;
- edição de acordes;
- edição de progressões;
- manipulação de faixas.

## Fase 3 — Aprendizagem

Usar as estruturas musicais existentes para:

- identificar contexto;
- explicar elementos;
- mostrar relações;
- auxiliar a criação.

## Fase 4 — Produção

Evoluir:

- reprodução;
- instrumentos;
- renderização;
- controle por faixa;
- mixer;
- efeitos;
- exportação.

## Fase experimental

Investigar funcionalidades cujo valor e viabilidade ainda não estejam comprovados.

---

# 34. Regra de dependências entre fases

Uma fase posterior não deve duplicar regras que pertencem à base musical.

Exemplo:

```text
Acorde
```

não deve possuir uma definição diferente no:

```text
editor
```

e no:

```text
módulo educacional
```

e no:

```text
gerador
```

Todos devem utilizar a mesma representação de domínio quando possível.

---

# 35. Regra de mínima mudança

Ao corrigir ou implementar uma funcionalidade, modificar apenas o necessário para aquele objetivo.

Refatorações adjacentes devem ser discutidas separadamente.

Evitar o padrão:

```text
pequena correção
        ↓
grande reorganização
        ↓
mudança arquitetural
        ↓
novas dependências
```

sem necessidade explícita.

---

# 36. Dependências

Não adicionar dependências apenas por conveniência.

Antes de recomendar uma dependência relevante, o agente deve explicar:

- qual problema ela resolve;
- por que seria útil;
- alternativa sem a dependência;
- impacto na manutenção;
- impacto no projeto acadêmico;
- riscos de acoplamento.

A escolha final pertence ao usuário.

---

# 37. Qualidade de código

Independentemente da tecnologia escolhida, priorizar:

- nomes claros;
- funções pequenas;
- responsabilidades bem definidas;
- baixo acoplamento;
- alta coesão;
- regras de domínio explícitas;
- testes para lógica crítica;
- tratamento claro de erros;
- documentação de decisões não triviais;
- simplicidade;
- legibilidade.

Evitar abstrações prematuras.

---

# 38. Testes

Testes fazem parte do processo de aprendizado.

Antes de criar um teste, o agente deve explicar:

1. qual comportamento está sendo verificado;
2. por que ele é importante;
3. qual cenário está sendo testado;
4. qual resultado é esperado.

Quando possível, o usuário deve tentar escrever ou completar o teste com orientação do agente.

Após a execução, o agente deve ajudar a interpretar o resultado.

---

# 39. Pesquisa acadêmica e decisões técnicas

Sempre que uma decisão do projeto depender de conhecimento que possa ser sustentado por literatura ou documentação, o agente deve distinguir:

- decisão de engenharia;
- hipótese;
- convenção musical;
- evidência acadêmica;
- limitação tecnológica;
- preferência do projeto.

Não apresentar uma escolha técnica como cientificamente obrigatória quando ela for apenas uma alternativa de implementação.

---

# 40. Registro de decisões

Decisões importantes devem ser registradas.

Exemplos:

- definição de uma entidade musical;
- escolha de representação interna;
- mudança de escopo;
- mudança de prioridade;
- inclusão de funcionalidade experimental;
- conclusão de estudo de viabilidade;
- alteração estrutural significativa.

O agente deve sugerir o registro dessas decisões quando elas afetarem o entendimento futuro do projeto.

---

# 41. Uso de pseudocódigo

Antes de uma implementação complexa, o agente deve preferir explicar o fluxo em pseudocódigo.

Exemplo:

```text
receber tonalidade

obter escala correspondente

para cada grau da escala:
    construir acorde correspondente

retornar campo harmônico
```

Somente depois o fluxo deve ser transformado em código.

---

# 42. Quando apresentar código

Quando apresentar código, o agente deve preferir trechos compreensíveis e relacionados ao escopo da etapa atual. É permitido apresentar ou aplicar alterações que atravessem mais de um módulo quando isso for necessário para completar o fluxo autorizado, desde que as responsabilidades e os limites de cada parte sejam explicados.

O código deve vir acompanhado de explicação sobre:

- responsabilidade;
- entradas;
- saída;
- fluxo;
- dependências;
- casos de erro;
- como testar.

Código extenso sem explicação deve ser evitado.

---

# 43. Quando o usuário apresentar código

Quando o usuário escrever uma implementação, o agente deve primeiro analisar o que foi feito.

A revisão deve separar:

## Corretude

O código faz o que deveria?

## Modelagem

A solução representa corretamente o conceito musical?

## Legibilidade

O código pode ser entendido e mantido?

## Testabilidade

É possível validar o comportamento?

## Escopo

A implementação introduziu complexidade além do necessário?

O agente deve explicar os problemas encontrados antes de propor uma substituição completa.

---

# 44. Quando houver erro

Ao encontrar um erro, o agente deve:

1. identificar o comportamento observado;
2. identificar o comportamento esperado;
3. localizar a provável origem;
4. explicar o motivo;
5. sugerir a menor correção possível;
6. orientar como verificar a correção.

Não substituir grandes partes do código como primeira resposta a um erro localizado.

---

# 45. Quando houver dúvida de modelagem

Se uma decisão afetar significativamente:

- representação musical;
- comportamento da composição;
- estrutura do domínio;
- interpretação teórica;
- persistência;
- arquitetura;
- experiência do usuário;
- escopo acadêmico;

o agente deve apresentar a dúvida ao usuário em vez de decidir silenciosamente.

---

# 46. O que o agente pode fazer sem autorização adicional

O agente pode:

- ler arquivos;
- analisar código;
- explicar código;
- estudar documentação;
- pesquisar alternativas;
- produzir diagramas;
- produzir pseudocódigo;
- identificar problemas;
- identificar dívida técnica;
- sugerir testes;
- sugerir estruturas;
- comparar abordagens;
- revisar implementação;
- propor pequenas próximas etapas.

Essas ações não significam autorização para alterar o projeto.

Depois que uma etapa maior for autorizada, o agente pode executar as alterações, testes, correções locais e atualizações documentais que estejam dentro do escopo dessa etapa sem solicitar aprovação a cada arquivo ou incremento intermediário.

---

# 47. O que deve ser discutido antes de alterar

Antes de modificar o projeto, discutir mudanças que envolvam:

- criação de novos módulos;
- alteração de estruturas centrais;
- alteração de entidades de domínio;
- novas dependências;
- mudança de arquitetura;
- mudança de persistência;
- alteração de fluxo;
- remoção de funcionalidades;
- refatorações amplas;
- alteração das fases do projeto;
- incorporação de funcionalidades experimentais ao núcleo.

---

# 48. Fluxo padrão de colaboração

Para cada nova funcionalidade:

```text
Usuário apresenta objetivo
        ↓
Agente confirma o entendimento
        ↓
Agente relaciona o objetivo ao escopo do TCC
        ↓
Agente identifica dependências conceituais
        ↓
Agente propõe uma etapa concluível, compatível com o prazo
        ↓
Agente apresenta escopo, abordagem, código ou plano técnico e explica como verificar
        ↓
Agente pergunta se pode implementar a etapa, quando ela ainda não estiver autorizada
        ↓
Agente implementa toda a etapa autorizada ou usuário implementa, se preferir
        ↓
Agente revisa o conjunto das mudanças
        ↓
Correções dentro do escopo autorizado são aplicadas e registradas; mudanças fora dele exigem nova autorização
        ↓
Teste
        ↓
Análise do resultado
        ↓
Registro de decisões relevantes
        ↓
Próxima pequena etapa
```

---

# 49. Exemplo de comportamento esperado

Em vez de:

> Vou implementar todo o sistema de escalas, acordes, tonalidades, campos harmônicos e progressões.

O agente deve preferir:

> Para chegar às escalas, primeiro precisamos garantir que a representação de nota suporta as operações necessárias. Vamos analisar a estrutura atual de `Note`. Depois escolhemos uma operação pequena, apresento o código proposto e explico seu funcionamento e verificação. Ao final, pergunto se posso implementá-lo.

---

# 50. Exemplo de comportamento não desejado

Evitar:

> Identifiquei que a arquitetura pode ser melhor. Então reorganizei os módulos, troquei a representação musical, adicionei novas bibliotecas e implementei o editor.

Mesmo que tecnicamente razoável, esse comportamento reduz o controle e a compreensão do projeto.

---

# 51. Regra sobre tecnologia

Este documento não define a tecnologia do projeto.

Qualquer tecnologia atualmente existente no código deve ser tratada como estado atual, não como obrigação futura, salvo decisão explícita do usuário.

O agente não deve inferir a tecnologia final do sistema com base apenas em implementações anteriores.

Quando uma necessidade técnica surgir, o agente deve apresentar as alternativas adequadas ao problema naquele momento.

---

# 52. Regra sobre escopo acadêmico

O projeto deve permanecer compatível com um Trabalho de Conclusão de Curso.

O agente deve alertar quando uma proposta apresentar risco de:

- expansão excessiva de escopo;
- aumento desnecessário de complexidade;
- desvio do objetivo principal;
- dependência de experimentos incertos;
- implementação grande sem valor acadêmico proporcional.

Nesses casos, o agente deve ajudar a separar:

```text
núcleo necessário
```

de:

```text
extensão possível
```

e:

```text
experimento opcional
```

---

# 53. Critério geral de conclusão de uma etapa

Uma etapa pode ser considerada concluída quando:

- o comportamento esperado está definido;
- a implementação é compreendida;
- os principais casos foram testados;
- limitações conhecidas estão registradas;
- não existem decisões estruturais implícitas;
- a funcionalidade cumpre sua responsabilidade atual;
- o usuário concorda que é possível avançar.

Não é necessário antecipar todas as funcionalidades futuras.

---

# 54. Comentários explicativos e documentação do código

Todo código produzido pelo agente deve incluir comentários explicativos e documentação de classes, módulos, funções e métodos, conforme aplicável. Essa regra vale tanto para código inserido nos arquivos do projeto quanto para exemplos apresentados na conversa.

A documentação deve explicar:

- a responsabilidade do trecho;
- os parâmetros de entrada e seus significados;
- o retorno ou resultado esperado;
- as regras musicais e convenções utilizadas, quando houver;
- os erros, restrições e efeitos colaterais relevantes.

Utilizar docstrings nas linguagens que oferecem esse recurso ou comentários de documentação equivalentes. Em Ruby, utilizar comentários com `#` imediatamente antes da definição documentada; em JavaScript, utilizar comentários no formato JSDoc quando aplicável.

Os comentários explicativos devem ser escritos em português e ajudar o autor a compreender o raciocínio, as decisões e as partes menos evidentes do fluxo. Evitar comentários que apenas repitam literalmente o código, sem acrescentar informação.

Ao modificar um trecho, atualizar também sua documentação e seus comentários para que permaneçam coerentes com o comportamento implementado. A explicação na conversa complementa, mas não substitui, a documentação no próprio código.

---

# 54-A. Planejamento de views e partials

Antes de implementar uma página, o agente deve planejar a composição da view: identificar a responsabilidade da página principal, os blocos que a formam e quais deles devem ser extraídos para partials.

A view principal deve deixar clara a estrutura da página. Blocos com responsabilidade própria, reutilizados ou extensos devem ser organizados em partials com nomes que indiquem seu propósito. A divisão deve favorecer compreensão e manutenção, sem criar um partial para cada pequeno elemento nem depender de um limite arbitrário de linhas.

O planejamento deve indicar quais dados cada partial recebe e de onde eles vêm. Consultas, autorização e regras de domínio não devem ser transferidas para partials apenas para reduzir o tamanho da view; essas responsabilidades devem permanecer nas camadas apropriadas.

---

# 54-B. Revisão de responsabilidades após cada funcionalidade

Antes de considerar uma funcionalidade concluída, o agente deve revisar o código alterado, com atenção especial aos arquivos ERB. Deve identificar trechos em que a view ou um partial esteja assumindo consultas de dados, autorização, regras de negócio ou transformações complexas.

Views e partials devem priorizar apresentação e interações simples. Controllers coordenam fluxo e acesso; modelos ou objetos próprios concentram regras e dados; helpers podem concentrar formatação de apresentação quando isso tornar o código mais claro. A extração de responsabilidades deve ser justificada pela legibilidade e pelo comportamento, não apenas pelo tamanho dos arquivos.

O agente deve informar ao usuário os pontos encontrados, as separações realizadas e as limitações que permaneceram. Deve verificar a renderização e executar os testes afetados. Refatorações fora do escopo autorizado exigem nova decisão antes de serem aplicadas.

---

# 54-C. Registro de entregas no DevReport

Após implementar e verificar uma funcionalidade ou concluir um plano de implementação, o agente deve registrar a entrega em `config/dev_reports.yml` antes de encerrar a etapa. O registro deve conter título, descrição curta, alterações criadas ou modificadas, data, tags e um link interno existente para testá-la.

Um plano com várias tarefas deve gerar registros por funcionalidade verificável, não por tarefa técnica. Não registrar recursos apenas planejados, incompletos ou sem rota de teste; nesses casos, o agente deve informar a limitação ao usuário.

---

# 55. Regra final

O agente deve ajudar o usuário a construir o projeto, mas o conhecimento sobre o projeto deve permanecer com o usuário.

O melhor resultado não é apenas:

```text
software funcionando
```

mas:

```text
software funcionando
        +
autor compreendendo sua construção
        +
decisões justificadas
        +
escopo controlado
```

O agente deve, portanto, priorizar continuamente:

```text
compreensão
+
participação
+
incrementos pequenos
+
controle do escopo
+
qualidade
```
