# Criação de composição em duas páginas

## Decisão

A primeira página recebe nome e capa e grava uma composição vazia. A segunda página, acessível apenas ao proprietário, oferece BPM, instrumento, tônica, modo e as propostas harmônicas atuais. A pessoa pode aplicar uma proposta, começar sem acordes com os controles escolhidos ou pular a configuração e entrar diretamente na harmonia.

## Responsabilidades e limites

`CompositionsController` coordena a criação e a configuração inicial. `CompositionStarter` continua responsável por validar e reconstruir a harmonia; o JavaScript existente continua apenas com prévia e seleção. A view de metadados mostra somente nome e capa na criação; uma view própria apresenta os controles e a ação de pular. O acesso à configuração não pode sobrescrever uma composição que já tenha música. Sem dependências ou mudança no contrato musical.

Como a primeira página já salva a composição, abandonar a segunda deixa um rascunho vazio na biblioteca. Esta etapa não introduz status de rascunho nem limpeza automática.

## Verificação

Testar a navegação entre páginas, o salvamento de nome/capa, o caminho de pular, a aplicação dos controles e acordes, entradas inválidas, propriedade da composição e proteção contra sobrescrita. Verificar a estrutura em desktop e celular.
