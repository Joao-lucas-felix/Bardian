# Início da composição e próximos passos

## Intenção

A criação reúne nome, capa e uma seção de primeiros sons com BPM, tônica, modo e instrumento. A pessoa ouve três propostas de quatro acordes, escolhe uma para iniciar a música ou começa sem acordes. A proposta permanece opcional e não grava nada antes do envio do formulário.

## Abordagens

- Escolhida: servidor reutiliza `Music::HarmonyGenerator` e entrega propostas ao navegador; o áudio usa o motor já presente na harmonia. Há uma única regra de geração e o servidor reconstrói os acordes escolhidos ao salvar.
- Descartada: replicar a geração em JavaScript. Reduz uma requisição, mas duplicaria regras musicais.

## Comportamento

- Tônica ou modo alterados disparam nova geração e limpam a escolha anterior.
- BPM ou instrumento alterados mantêm os acordes e atualizam a escuta.
- A escolha enviada identifica os quatro graus; o servidor valida cada grau no campo harmônico e reconstrói as alturas, os eventos MIDI e os blocos harmônicos declarados com o contexto enviado. Um envio inválido não cria a composição.
- A nova composição usa 4/4 e abre a página de harmonia. A escolha do instrumento fica na faixa harmônica mesmo quando a faixa ainda não contém notas.
- A página de harmonia oferece acesso a “Próximo passo”. A tela seguinte leva ao piano roll para ornamentar e lista baixo, batida e melodia como etapas futuras. Nenhum gerador novo nem assistência por gênero entra nesta etapa.

## Limites e verificação

Usar apenas as dependências atuais. Verificar geração sem persistência, regeneração ao mudar contexto, preservação de graus ao mudar BPM/instrumento, persistência exata da escolha sem recuperação de harmonia, submissões inválidas, acesso restrito à próxima tela e navegação com alterações não salvas. Inspecionar as duas telas em desktop e celular e registrar a entrega no DevReport.
