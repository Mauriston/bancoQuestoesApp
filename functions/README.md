# Cloud Functions — geração do relatório de prova em PDF no servidor

`generateExamReportPdf` (ver `src/index.ts`) recebe um `attemptId`, busca os
mesmos dados que `ExamResultPage` mostra em tela, renderiza o template do
relatório (`../src/reportTemplate.ts`, compartilhado com o frontend via
`copy-shared.mjs`) com Chromium headless (`puppeteer-core` +
`@sparticuz/chromium`), salva o PDF no Firebase Storage e devolve uma URL
de download.

Por que no servidor em vez de `window.print()` no navegador: o fluxo
client-side depende do usuário configurar corretamente o diálogo de
impressão do navegador (margens "Nenhuma", sem cabeçalhos/rodapés) e de
todas as imagens/fontes já terem carregado no momento da impressão — mesmo
corrigindo essa corrida no cliente (ver `waitUntilReadyToPrint` em
`reportTemplate.ts`), o resultado final ainda passa pelo motor de impressão
do navegador/SO do usuário, fora do nosso controle. Aqui roda tudo num
ambiente controlado, sem diálogo de impressão e sem depender do navegador
do candidato.

## Pré-requisitos para o deploy (únicos, feitos manualmente uma vez)

1. **Plano Blaze (pay-as-you-go)** ativo no projeto Firebase
   `gen-lang-client-0316191622` — Cloud Functions não roda no plano Spark
   gratuito. Sem isso, `firebase deploy --only functions` falha imediatamente.
2. A Service Account usada pelo workflow de deploy (secret
   `FIREBASE_SERVICE_ACCOUNT`, a mesma já usada para o deploy do Hosting)
   precisa de permissões adicionais no IAM do projeto GCP, além das que o
   Hosting já exige:
   - Cloud Functions Admin
   - Service Account User
   - Cloud Build Editor
   - Artifact Registry Writer (ou Admin)
   - Eventarc Admin (funções 2ª geração usam Eventarc/Pub-Sub internamente)
3. No primeiro deploy, as APIs a seguir precisam estar habilitadas no
   projeto GCP (o Firebase CLI oferece para habilitar automaticamente em
   modo interativo; em CI/não-interativo, precisam já estar ativas ou o
   deploy falha com um erro apontando qual API falta):
   - Cloud Functions API
   - Cloud Build API
   - Artifact Registry API
   - Eventarc API
   - Cloud Run API (funções 2ª geração rodam sobre Cloud Run)

## Modelo de autorização

A função exige apenas uma sessão autenticada do Firebase Auth (inclusive
anônima, a mesma usada pelos candidatos — ver `AuthContext`/`authService`
no frontend), **sem** verificar se quem chama é de fato o dono da
tentativa (`attempt.userId`). Isso replica a mesma limitação já documentada
em `../firestore.rules`: sessões de candidato usam Auth anônimo e nunca
persistem o vínculo `authUid → users/{id}`, então hoje não há como validar
posse de forma confiável em nenhuma parte do app — não é uma regressão de
segurança nova, é o mesmo modelo de acesso já em vigor no resto do banco de
questões (quem tem uma sessão válida consegue, tecnicamente, ler
gabaritos/tentativas de qualquer id).

## Como o PDF fica acessível

O arquivo é salvo em `exam-reports/{attemptId}/relatorio.pdf` no bucket
padrão, com um token de download aleatório (`firebaseStorageDownloadTokens`)
gerado a cada chamada — o mesmo mecanismo que `getDownloadURL()` usa no SDK
cliente. A URL retornada (`https://firebasestorage.googleapis.com/v0/b/...`)
funciona sem login, mas só quem tiver o link (com o token) consegue baixar;
cada nova geração troca o token, invalidando links antigos para o mesmo
`attemptId`.

## Desenvolvimento local

```bash
cd functions
npm install
npm run build      # roda copy-shared.mjs (copia reportTemplate.ts/types.ts
                    # de ../src) e depois tsc
```

Nunca edite `functions/src/_shared/*` diretamente — é sobrescrito a cada
build. Edite `../src/reportTemplate.ts` (fonte compartilhada com o
frontend) ou `src/index.ts` (lógica específica da função).
