# TechCatalog — Angular + Node.js

Projeto acadêmico completo: API com validação JWT e frontend Angular para CRUD de tecnologias.

## Requisitos
- Node.js 24.x LTS e npm. Confirme com `node -v` e `npm -v`.
- Nenhum servidor de banco de dados é necessário: o SQLite é criado em `backend/data/database.sqlite`.
- Internet para instalar as dependências. Angular CLI global não é necessário.

## Instalação e execução
Na pasta raiz extraída:

```sh
npm install
npm run install:all
```

Copie `backend/.env.example` para `backend/.env`. No PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

No Linux/macOS:

```sh
cp backend/.env.example backend/.env
```

Gere uma chave:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Abra `backend/.env` e substitua o valor de JWT_SECRET pela chave gerada. Mantenha PORT=3000, pois o proxy usa essa porta.

Execute na raiz:

```sh
npm run dev
```

Abra http://localhost:4200 e clique em “Ainda não tenho conta”. Não existem credenciais padrão. Crie seu usuário, cadastre e edite tecnologias. Ctrl+C encerra os dois serviços.

API: http://localhost:3000/api/health

O Angular encaminha `/api` à API via `proxy.conf.json`: não é necessário liberar CORS no ambiente local. Não abra `index.html` diretamente.

## Funcionalidades
- Cadastro de conta e login com bcrypt e JWT de 1 hora.
- Interceptor HTTP inclui Bearer token; respostas 401 das rotas protegidas encerram a sessão.
- Token em sessionStorage: persiste ao recarregar e é removido no logout; expiração é verificada pela API.
- Dados privados por usuário em todas as operações, inclusive leitura por ID.
- Criar, listar, consultar por ID, editar e excluir tecnologias.
- Tabela, busca por nome, confirmação antes de excluir, validações e feedback.
- Campos: nome, linguagem base e curva de aprendizado em horas inteiras.
- Bases: PHP, C#, JavaScript, TypeScript, Java, Python e Outra.
- Sem dados de exemplo pré-cadastrados; cadastre React, Vue, Node.js ou Angular pela tela.

A unidade “horas” foi escolhida porque a imagem solicita tempo até a proficiência, mas não especifica unidade. Linguagem base usa nomes completos: JS → JavaScript. Não há duração universal de proficiência: o valor é informado pelo usuário.

## Estrutura
```text
backend/
  src/app.js          API, banco, validações, autenticação e rotas
  src/server.js       inicialização e desligamento
  test/api.test.js    integração automatizada
  .env.example
frontend/
  src/app/api.service.ts       comunicação HTTP e interceptor
  src/app/app.component.ts    estado e formulários
  src/app/app.component.html  interface
  src/styles.css              visual responsivo
  proxy.conf.json
package.json                  comandos dos dois projetos
```

## Testes e build
```sh
npm test
npm run build
```

Os testes usam banco em memória e porta aleatória. Cobrem cadastro, login, token ausente/inválido, CRUD, busca, dados inválidos, duplicidade e isolamento entre usuários.
Build frontend em `frontend/dist/web/browser`. O build não inicia servidor nem publica a API. Os testes foram incluídos, mas precisam ser executados no seu ambiente; o ZIP foi gerado sem instalar dependências ou executar Node/Angular.

## API
Rotas públicas:
- GET /api/health
- POST /api/auth/register — `{ "name": "Aluno", "email": "aluno@example.com", "password": "Senha123!" }`
- POST /api/auth/login — `{ "email": "aluno@example.com", "password": "Senha123!" }`

As duas rotas de autenticação devolvem `{ token, user }`.

Rotas protegidas (cabeçalho `Authorization: Bearer SEU_TOKEN`):
- GET /api/auth/me
- GET /api/technologies
- GET /api/technologies?search=angular
- GET /api/technologies/:id
- POST /api/technologies
- PUT /api/technologies/:id
- DELETE /api/technologies/:id

Corpo para POST/PUT:
```json
{ "name": "Angular", "base": "TypeScript", "learningHours": 80 }
```

POST retorna 201, DELETE 204; falhas de validação 400, autenticação 401, recurso inexistente ou pertencente a outro usuário 404, duplicidade 409, excesso de tentativas 429.

## Exemplo com curl
```sh
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"name":"Aluno","email":"aluno@example.com","password":"Senha123!"}'
curl http://localhost:3000/api/technologies -H "Authorization: Bearer COLE_O_TOKEN"
```
No Windows, prefira `curl.exe` e adapte o escape de aspas ao terminal; a interface oferece o fluxo completo sem curl.

## Limitações e produção
- Projeto didático, sem refresh token, recuperação de senha, verificação de e-mail ou revogação de JWT. Logout remove a cópia local, mas um token copiado continua válido até expirar.
- sessionStorage é acessível a JavaScript. Produção exige revisão de segurança e mitigação de XSS; considerar sessão em cookie HttpOnly com proteção CSRF adequada.
- Utilize HTTPS, segredo exclusivo, backups, monitoramento e gestão de dependências em publicação real.
- Limite de autenticação em memória, por IP: para várias instâncias configure armazenamento compartilhado e proxy confiável.
- API escuta em 127.0.0.1 para execução local. Container/hospedagem podem exigir alteração explícita do host, proxy reverso e estratégia para arquivos persistentes.
- Hospede o build Angular e encaminhe /api para o backend no mesmo domínio. O proxy do ng serve só funciona em desenvolvimento.
- SQLite síncrono é apropriado à demonstração local; revise concorrência e persistência para maior escala.
- Sem paginação; busca simples com lower() do SQLite (normalização Unicode não é completa).
- Não acompanha package-lock: o primeiro npm install resolve as versões das faixas declaradas. Versione os locks gerados para reproduzir a instalação.

## Solução de problemas
- “JWT_SECRET precisa...” → confira backend/.env e o tamanho da chave.
- Erro em node:sqlite ou flags de ambiente → utilize Node.js 24.x.
- Porta ocupada → feche outro processo na 3000/4200. Se mudar a porta da API, atualize o proxy Angular.
- Falha na API → confirme os logs do terminal e acesse /api/health.
- Banco zerado → confira a pasta de trabalho; execute sempre pelos scripts da raiz/backend.
- Aviso experimental de SQLite pode aparecer dependendo da versão do Node; não significa necessariamente falha.

## Referências de implementação
Angular: https://angular.dev/guide/forms/reactive-forms
HTTP Angular: https://angular.dev/guide/http/setup
JWT Node.js: https://www.luiztools.com.br/post/autenticacao-json-web-token-jwt-em-nodejs/
