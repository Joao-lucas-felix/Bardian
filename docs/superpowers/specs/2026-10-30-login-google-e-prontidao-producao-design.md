# Login Google e preparação da versão básica para produção

## Intenção

Concluir as funcionalidades já presentes em `feature/music-domain-models`, oferecer
login com Google além de e-mail e senha, e transformar as verificações da versão
básica em uma porta de entrada para publicação. Os commits devem representar
entregas verificáveis e preservar o histórico de decisões do TCC.

## Escopo e decisões

- Manter Devise e as contas locais existentes. Adicionar `omniauth-google-oauth2`
  para o fluxo OAuth no servidor Rails. A alternativa considerada, Google Identity
  Services com validação própria de tokens, exigiria mais código de autenticação
  para o mesmo fluxo atual.
- Identificar a conta Google pelo identificador estável do provedor, com índice
  único e sem usar o e-mail como identidade duradoura. Aceitar o retorno apenas
  quando o Google informar e-mail verificado. Criar conta comum para um e-mail
  ainda não cadastrado, com senha aleatória desconhecida do usuário.
- Quando o e-mail já pertencer a uma conta local sem Google, orientar o usuário a
  entrar com senha e vincular o Google explicitamente. A vinculação começa em
  sessão autenticada, exige o retorno do Google e não pode usar uma identidade
  Google vinculada a outra conta. Não haverá vinculação automática por e-mail.
- Mostrar o botão Google no login/cadastro e a ação de vincular no menu da conta.
  As views apenas apresentam formulários e estado; a busca e as regras de
  identidade ficam no modelo/controller.
- Configurar ID e segredo OAuth por variáveis de ambiente, sem versionar valores.
  Documentar o callback HTTPS e o cadastro no Google Cloud. Manter o login local
  disponível quando as credenciais Google não estiverem configuradas.
- Revisar o conjunto atual de alterações, deixar artefatos gerados fora dos
  commits, corrigir falhas impeditivas e registrar as entregas
  verificadas em `config/dev_reports.yml`.
- Ampliar o CI para executar os testes Rails e JavaScript, lint e build do motor
  de áudio. Validar a construção da imagem Docker quando o ambiente permitir.
  Agrupar as mudanças em commits por entrega funcional, sem publicar ou fazer
  merge automaticamente.

## Comportamento esperado

```text
Visitante clica em "Entrar com Google"
  → Google confirma a identidade
  → identidade conhecida: entrar na conta vinculada
  → e-mail novo e verificado: criar conta comum e entrar
  → e-mail local existente: pedir login por senha e vinculação explícita

Usuário autenticado clica em "Vincular Google"
  → Google confirma a identidade
  → identidade livre: vincular à conta atual
  → identidade já vinculada: recusar sem mudar contas
```

## Verificação

- Testes de login, criação, vinculação, e-mail não verificado, conflito de conta,
  falha/cancelamento OAuth e preservação do login por senha, com respostas OAuth
  simuladas; não dependem de credenciais reais.
- Executar a suíte Rails, a suíte JavaScript, RuboCop e verificações de build.
  Rever os arquivos ERB afetados quanto a consultas e regras de negócio.
- Verificar manualmente o fluxo Google no domínio final após cadastrar o cliente
  OAuth e seus redirecionamentos. A imagem de produção depende de acesso ao
  daemon Docker ou de um runner de CI.

## Limites desta etapa

Não há servidor, domínio nem registro OAuth de produção definidos no repositório.
O pipeline desta etapa prepara uma versão candidata e suas verificações; o deploy
automático, a configuração Kamal de um destino real e o teste ponta a ponta com
credenciais Google ficam para a decisão de infraestrutura. Não serão adicionados
recuperação de senha, desvinculação de Google ou novos perfis de conta.
