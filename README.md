# Banco de Questões TEOT — HMA 2027

Aplicação web para estudo, simulados e gestão de banco de questões voltada à preparação para o **TEOT** (Título de Especialista em Ortopedia e Traumatologia) e provas correlatas (SBOT, TARO), organizada segundo a árvore de áreas/temas da especialidade.

O app tem dois "lados":

- **Área do candidato (`/app/*`)** — o residente/candidato responde provas atribuídas a ele, acompanha histórico e desempenho por área/tema.
- **Área administrativa (`/admin/*`)** — um administrador cadastra questões (com gabarito protegido), monta e publica provas, atribui provas a usuários, acompanha tentativas e gerencia usuários.

Todo o backend é **serverless**, provido inteiramente pelo **Firebase** (Authentication, Firestore, Storage e Hosting) — não há banco de dados ou servidor de aplicação próprios em produção.

> Nome do produto exibido na UI: **"Treinamento TEOT HMA 2027"** (ver `index.html` / `metadata.json`).

---

## Sumário

1. [Stack tecnológica](#stack-tecnológica)
2. [Arquitetura em alto nível](#arquitetura-em-alto-nível)
3. [Estrutura de pastas](#estrutura-de-pastas)
4. [Firebase — visão geral do projeto](#firebase--visão-geral-do-projeto)
5. [Firebase Authentication](#firebase-authentication)
6. [Firestore — modelo de dados](#firestore--modelo-de-dados)
7. [Firebase Storage — imagens das questões](#firebase-storage--imagens-das-questões)
8. [Firebase Hosting e deploy (CI/CD)](#firebase-hosting-e-deploy-cicd)
9. [Rotas da aplicação](#rotas-da-aplicação)
10. [Variáveis de ambiente e configuração](#variáveis-de-ambiente-e-configuração)
11. [Rodando localmente](#rodando-localmente)
12. [Scripts npm/bun](#scripts-npmbun)
13. [Pontos de atenção / dívidas técnicas conhecidas](#pontos-de-atenção--dívidas-técnicas-conhecidas)
14. [Histórico relevante recente](#histórico-relevante-recente)

---

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework UI | React 18 + TypeScript |
| Roteamento | React Router DOM v7 (`BrowserRouter`) |
| Build/Bundler | Vite 6 (`@vitejs/plugin-react`) |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Ícones | lucide-react |
| Animações | motion (Framer Motion) |
| Gráficos | recharts |
| Validação | zod |
| Backend/dados | Firebase (Auth, Firestore, Storage, Hosting) |
| Servidor de desenvolvimento/API auxiliar | Express + `tsx` (`server.ts`) |
| Geração de questões por IA (opcional) | `@google/genai` (Gemini) — apenas no servidor Express, não usado em produção estática |
| Gerenciador de pacotes | Bun (usado no CI); `bun.lock` versionado |
| Hospedagem | Firebase Hosting (SPA estática) |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) |

## Arquitetura em alto nível

```
┌───────────────────────────┐        ┌──────────────────────────────────────┐
│   Navegador (SPA React)   │        │        Projeto Firebase                │
│                            │        │  gen-lang-client-0316191622            │
│  index.html → main.tsx    │        │                                        │
│  → App → AuthProvider     │──────▶ │  Auth        (login admin/anônimo)     │
│  → AppRoutes               │        │  Firestore   (dados da aplicação)      │
│                            │        │  Storage     (imagens das questões)    │
└───────────────────────────┘        │  Hosting     (serve o build estático)  │
                                       └──────────────────────────────────────┘
```

Em **produção**, o app é um SPA 100% estático: `vite build` gera `dist/`, e o Firebase Hosting serve esse diretório, redirecionando qualquer rota para `index.html` (roteamento fica todo no cliente, via React Router). Todo acesso a dados é feito **diretamente do navegador** para o Firestore/Storage através do SDK cliente do Firebase (`firebase` npm package) — não existe uma API própria intermediando essas chamadas em produção.

Existe também um **servidor Express local** (`server.ts`, rodado via `bun run dev` / `npm run dev`) usado **apenas em desenvolvimento** para servir o Vite em modo middleware e expor um endpoint auxiliar de geração de questões via IA (`POST /api/generate-questions`, usando Gemini quando `GEMINI_API_KEY` está definido, com fallback para questões geradas localmente). Esse servidor **não é usado no deploy real** (ver [Pontos de atenção](#pontos-de-atenção--dívidas-técnicas-conhecidas)).

## Estrutura de pastas

```
bancoQuestoesApp/
├── .github/workflows/deploy.yml   # CI: build + deploy no Firebase Hosting (push em main)
├── firebase.json                  # Config do Firebase Hosting (public dir, rewrites SPA)
├── .firebaserc                    # Projeto Firebase padrão (gen-lang-client-0316191622)
├── firebase-applet-config.json    # Config pública do Firebase Web App (apiKey, projectId, etc.)
├── vite.config.ts                 # Build do frontend (React + Tailwind)
├── server.ts                      # Servidor Express (dev + endpoint de IA), não usado no deploy
├── index.html                     # Entry HTML (com capturador global de erros)
├── metadata.json                  # Metadados do app (nome, descrição)
├── arvore_temas.json              # Árvore estática de áreas/temas de ortopedia (usada no dev server e em ArvoreTemasView)
├── .env.example                   # Modelo de variáveis de ambiente
└── src/
    ├── main.tsx                   # Bootstrap do React (ReactDOM.createRoot)
    ├── App.tsx                    # BrowserRouter + AuthProvider + AppRoutes
    ├── index.css                  # `@import "tailwindcss"` + estilos globais
    ├── routes/AppRoutes.tsx       # Definição de todas as rotas e guards de acesso
    ├── contexts/AuthContext.tsx   # Estado de sessão/usuário atual (React Context)
    ├── layouts/                   # UserLayout (candidato) e AdminLayout (admin)
    ├── pages/
    │   ├── HomePage.tsx, AdminLoginPage.tsx, UnauthorizedPage.tsx
    │   ├── app/                   # Telas do candidato: provas, tentativa, resultado, histórico, desempenho
    │   └── admin/                 # Telas do admin: dashboard, usuários, questões, importação, provas, tentativas
    ├── components/                # QuestionImage, QuizEngine, StatsView, Header, etc.
    ├── services/
    │   ├── firebase.ts            # Inicialização do Firebase App/Auth/Firestore/Storage
    │   ├── firebaseService.ts     # Toda a camada de acesso a dados (Firestore + Storage)
    │   ├── authService.ts         # Login admin (email/senha) e "login" de candidato (seleção de usuário)
    │   ├── gradingService.ts      # Correção de provas e atualização de estatísticas agregadas
    │   └── importService.ts       # Importação em massa de banco de questões via JSON
    ├── firebase/config.ts         # Reexporta app/auth/db/storage/firebaseConfig para o resto do app
    ├── schemas/index.ts           # Schemas Zod (validação de payloads, ex.: importação)
    ├── types.ts / types/index.ts  # Definições de tipos TypeScript do domínio (ver observação abaixo)
    └── utils/helpers.ts           # normalizeText, generateId, shuffleArray, formatDate, exportToCSV...
```

## Firebase — visão geral do projeto

| Item | Valor |
|---|---|
| **Project ID** | `gen-lang-client-0316191622` |
| **Auth Domain** | `gen-lang-client-0316191622.firebaseapp.com` |
| **App ID (Web)** | `1:1001740918051:web:5d931926acb0883d160096` |
| **Firestore Database ID** | `ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6` (⚠️ **não é** o banco `(default)`) |
| **Storage Bucket** | `gen-lang-client-0316191622.firebasestorage.app` |
| **Hosting (URL pública)** | `https://gen-lang-client-0316191622.web.app` |

A configuração pública do Web App fica versionada em **`firebase-applet-config.json`** na raiz do repo e é importada diretamente por `src/services/firebase.ts`:

```ts
import firebaseConfigJson from "../../firebase-applet-config.json";

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId); // banco nomeado, não o (default)
export const storage = getStorage(app);
```

> A `apiKey` do Firebase Web App **não é secreta** por design (ela apenas identifica o projeto ao SDK cliente) — a segurança real dos dados é garantida pelas **Regras de Segurança** do Firestore/Storage configuradas no console do Firebase, que **não estão versionadas neste repositório** (não há `firestore.rules` nem `storage.rules` no código-fonte). Isso é um ponto de atenção — ver seção de dívidas técnicas.

Também existem `VITE_FIREBASE_*` declaradas em `.env.example` / `src/vite-env.d.ts` como *overrides* opcionais dessas mesmas configurações, mas **nenhum arquivo do código atualmente lê `import.meta.env.VITE_FIREBASE_*`** — a fonte de verdade em uso é o `firebase-applet-config.json`. Essas variáveis existem para uma futura migração para configuração via ambiente, mas hoje são vestigiais.

## Firebase Authentication

O app usa um modelo **híbrido** de identidade, combinando Firebase Auth com um cadastro de usuários próprio no Firestore (coleção `users`):

- **Candidatos (`role: "user"`)** não digitam senha. O fluxo (`HomePage` → `authService.loginUserBySelection`) é: o candidato escolhe seu nome numa lista de usuários ativos cadastrados pelo admin, o app grava o `userId` selecionado em `localStorage` (`teot_active_session_user_id`) e autentica no Firebase via **login anônimo** (`signInAnonymously`) apenas para satisfazer as Regras de Segurança do Firestore/Storage (que provavelmente exigem `request.auth != null`).
- **Administradores (`role: "admin"`)** fazem login com e-mail/senha reais (`AdminLoginPage` → `authService.loginAdminWithPassword`), usando `signInWithEmailAndPassword`. Há lógica de auto-bootstrap: se o e-mail ainda não existir no Firebase Auth, o app tenta criar a conta na hora (`createUserWithEmailAndPassword`) e, se não existir documento correspondente em `users`, cria um automaticamente com `role: "admin"`.
- `firebaseService.ensureAdminUserExists()` roda automaticamente ao carregar o módulo de serviços e garante a existência de um admin "seed" (`usr_mauriston_admin`, e-mail `mauriston@oncoortopedia.com`) na coleção `users`.
- `AuthContext` (`src/contexts/AuthContext.tsx`) é a fonte de verdade do usuário logado na UI: ele lê o `userId` da sessão local, busca o documento correspondente em `users` no Firestore, e também escuta `onAuthStateChanged` do Firebase Auth para re-sincronizar.
- `AppRoutes.tsx` implementa dois *route guards*: `UserProtectedRoute` (exige `currentUser.active`) e `AdminProtectedRoute` (exige adicionalmente `role === "admin"`), redirecionando para `/`, `/inactive` ou `/unauthorized` conforme o caso.

> Ou seja: o Firebase Auth garante que toda sessão (mesmo de candidato) tenha um `request.auth` válido perante as Regras de Segurança, mas a **autorização de negócio** (quem é admin, quem está ativo) é decidida pelo documento em `users` no Firestore, não por *custom claims* do Firebase Auth.

## Firestore — modelo de dados

Banco: `ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6` (Firestore em modo Native, banco nomeado — todo acesso no código passa esse ID explicitamente para `getFirestore(app, firestoreDatabaseId)`).

### Coleções de topo

| Coleção | Documento representa | Principais campos |
|---|---|---|
| `users` | Usuário (candidato ou admin) | `name`, `email`, `role` (`user`\|`admin`), `active`, `authUid?` |
| `areas` | Área da especialidade (ex.: Ortopedia Pediátrica) | `name`, `normalizedName`, `questionCount`, `active` |
| `themes` | Tema dentro de uma área | `areaId`, `name`, `normalizedName`, `questionCount`, `active` |
| `questions` | Questão (**pública**, sem gabarito) | `areaId`, `themeId`, `sourceExam`, `statement`, `alternatives{A,B,C,D}`, `imageUrl`, `active` |
| `questionAnswers` | Gabarito/comentário da questão (**doc ID = questionId**) | `correctAlternative`, `solutionText`, `comments` — **separado de `questions` de propósito**, para permitir Regras de Segurança que escondem o gabarito do candidato antes de ele responder |
| `exams` | Prova/simulado | `name`, `status` (`draft`\|`published`\|`archived`), `active` (visibilidade — provas nascem `false`), `questionCount`, `shuffleQuestions`, `shuffleAlternatives`, `showResultAfterFinish`, `showCommentsAfterFinish`, `allowReviewAfterFinish`, `createdBy` |
| `exams/{examId}/questions` | **Subcoleção**: cópia "congelada" das questões selecionadas no momento da publicação da prova | mesmos campos de `Question` + `orderIndex`/`order` — congelar evita que editar/excluir uma questão original quebre provas já publicadas |
| `examAssignments` | Atribuição de uma prova a um usuário específico | `examId`, `userId`, `status` (`available`\|`started`\|`completed`), `attemptId?` |
| `attempts` | Tentativa de um usuário numa prova | `examId`, `assignmentId`, `userId`, `status` (`in_progress`\|`grading`\|`completed`), `correctAnswers`, `wrongAnswers`, `unansweredQuestions`, `scorePercentage` |
| `attempts/{attemptId}/answers` | **Subcoleção**: cada resposta marcada pelo candidato | `examQuestionId`, `originalQuestionId`, `selectedAlternative`, `isCorrect` (preenchido só na correção), `areaId`, `themeId` |
| `userStats` | Estatística agregada por usuário (**doc ID = userId**) | `totalSolved`, `totalCorrect`, `overallScorePercentage`, `areas{ [areaId]: {solved,correct} }`, `themes{ [themeId]: {...} }` |
| `adminLogs` | Log de ações administrativas | `adminId`, `adminName`, `action`, `details`, `timestamp` |
| `imports` | Histórico de importações em massa de questões via JSON | `importedBy`, `totalAreas`, `totalThemes`, `totalQuestions`, `createdQuestions`, `errors[]`, `status` |

### Fluxo de vida de uma prova (ponta a ponta)

1. **Admin cadastra questões** (`QuestionsPage`) → grava em `questions` (público) + `questionAnswers` (gabarito protegido), opcionalmente enviando uma imagem para o **Storage** (`uploadQuestionImage`).
2. **Admin monta e publica uma prova** (`CreateExamPage` → `firebaseService.createAndPublishExam`):
   - Cria o documento em `exams` (nasce com `active: false` — só fica visível ao candidato depois que o admin ativa explicitamente em `ExamsListPage`).
   - Copia as questões selecionadas para a subcoleção `exams/{examId}/questions` (congelamento — protege a prova contra futuras edições nas questões originais).
   - Cria um documento em `examAssignments` para cada usuário-alvo (ou para todos os usuários ativos com `role !== "admin"`, se "todos" for escolhido).
   - Tudo isso é feito em `writeBatch`, respeitando o limite de 500 operações por lote do Firestore (o código comita em blocos de ~400).
3. **Candidato inicia a prova** (`TakeExamPage` → `firebaseService.startExamAttempt`): dentro de uma `runTransaction`, reaproveita uma tentativa `in_progress` existente ou cria uma nova em `attempts`, atualizando a `examAssignment` para `status: "started"`. A transação evita que cliques duplicados/abas simultâneas criem duas tentativas para a mesma atribuição.
4. **Candidato responde** cada questão → `saveAttemptAnswer` grava/atualiza um doc em `attempts/{id}/answers/{examQuestionId}` a cada seleção (sem revelar o gabarito, que fica em `questionAnswers` e só é lido no back-office de correção).
5. **Candidato finaliza** → `gradingService.finishAndGradeAttempt`:
   - Reivindica a correção atomicamente (`status: "in_progress" → "grading"`) para impedir dupla-contagem em caso de clique duplo/duas abas.
   - Compara cada resposta com `questionAnswers` (gabarito), grava `isCorrect` em cada resposta, calcula `scorePercentage`.
   - Atualiza `attempts` para `status: "completed"` e a `examAssignment` correspondente para `status: "completed"`.
   - Atualiza `userStats/{userId}` (agregado geral + por área + por tema) dentro de outra `runTransaction`.
6. **Exclusão em cascata**: `deleteExam()` e `deleteAttempt()` fazem limpeza best-effort de dados órfãos (questões congeladas, `examAssignments`, `attempts`/`answers`) e revertem o que uma tentativa completada havia somado em `userStats` (`subtractFromUserStats`), para que o dashboard e "Meu Desempenho" não fiquem inflados após exclusões administrativas.

### Importação em massa

`ImportPage` (admin) aceita um JSON no formato de `arvore_temas.json`-like (`{ dados: [{ Área, temas: [{ Tema, questoes: [...] }] }] }`, com várias variações de capitalização suportadas) e usa `importService.importQuestionBankJson` para popular `areas`, `themes`, `questions` e `questionAnswers` em lote, registrando o resultado em `imports`.

## Firebase Storage — imagens das questões

Bucket: **`gen-lang-client-0316191622.firebasestorage.app`**.

Existem hoje **duas origens/convenções de caminho** para imagens no bucket, refletindo a migração de "URLs externas" para "Storage nativo":

1. **`question-images/{questionId}/{timestamp}.{ext}`** — caminho gerado automaticamente pelo upload feito na UI administrativa (`firebaseService.uploadQuestionImage`, usado em `QuestionsPage`). O admin escolhe um arquivo de imagem ao criar/editar uma questão, o app faz `uploadBytes` para esse caminho e grava a `getDownloadURL()` resultante no campo `imageUrl` do documento em `questions`.
2. **`imagens_questoes/{PROVA}/{ARQUIVO}`** (ex.: `imagens_questoes/TEOT_ANATOMIA_2024/TEOT-2024-ANATOMIA-Q01.jpeg`) — convenção usada para **lotes de imagens enviados manualmente** ao Storage (fora do fluxo de upload da UI), como parte da migração das questões que antes referenciavam imagens hospedadas em serviços externos (Imgur, Flickr) via URL direta no campo `imageUrl`. Essas URLs completas (`https://firebasestorage.googleapis.com/v0/b/.../o/imagens_questoes%2F...?alt=media`) precisam ser gravadas manualmente (ou por script) no campo `imageUrl` de cada `question` correspondente — não há hoje, no código deste repositório, um importador automático que faça esse casamento "arquivo do bucket ↔ questão".

Independentemente da origem, todo campo `imageUrl` do domínio é tratado como uma **URL absoluta e pronta para uso** (`<img src={question.imageUrl}>`), consumida diretamente em:

- `TakeExamPage` e `ExamResultPage` (tela do candidato) — `<img>` simples com clique para ampliar em modal.
- `QuestionImage.tsx` (componente reutilizável usado no back-office: `QuestionPreviewModal` e `ExamViewPage` do admin) — inclui *fallback* visual (`onError`) com link "Abrir link da imagem" caso o carregamento falhe, e um `getFullImageUrl()` que só reescreve caminhos relativos iniciados por `/` (relevante apenas para o legado de imagens que chegaram a ficar em `public/imagens_questoes/...` do próprio build do Vite — ver histórico abaixo — já que qualquer `imageUrl` do Storage já vem como URL absoluta `https://firebasestorage.googleapis.com/...` e passa direto por essa função).

> **CORS do bucket**: como as imagens do Storage são carregadas via tag `<img>` comum (não via SDK do Storage), o navegador as busca como um recurso cross-origin normal — isso funciona out-of-the-box para leitura pública de imagens (o Storage responde com `Access-Control-Allow-Origin: *` por padrão para GET quando as Regras de Segurança permitem leitura pública). Se as Regras de Storage exigirem autenticação para leitura, é preciso confirmar que a leitura anônima (usada pelos candidatos) está contemplada.

## Firebase Hosting e deploy (CI/CD)

`firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

- `public: "dist"` — a Hosting serve exatamente o que `vite build` gera em `dist/` (HTML + JS/CSS com hash + assets).
- O `rewrite` `"**" → "/index.html"` é o padrão de SPA: qualquer caminho sem correspondência de arquivo estático real cai no `index.html`, e o React Router assume o roteamento no cliente. Arquivos estáticos existentes em `dist/` (JS, CSS, favicon etc.) têm prioridade sobre esse rewrite — comportamento padrão do Firebase Hosting.
- `.firebaserc` fixa o projeto padrão (`gen-lang-client-0316191622`), então `firebase deploy` não precisa de `--project` quando rodado localmente com o CLI autenticado (o workflow de CI passa `--project` explicitamente por segurança/clareza).

**Deploy automático** (`.github/workflows/deploy.yml`), disparado a cada `push` na branch **`main`**:

1. Checkout do repositório.
2. Setup de Node 24 e Bun.
3. `bun install`.
4. `bun run build` (→ `vite build`, gera `dist/`).
5. Instala `firebase-tools` globalmente.
6. `firebase deploy --only hosting --project gen-lang-client-0316191622`, autenticado via secret `FIREBASE_TOKEN` do repositório (`GEMINI_API_KEY` também é passada ao ambiente, embora não seja usada no build puramente estático).

> O deploy é `--only hosting` propositalmente: o projeto **não tem uma pasta `functions/`** (nenhuma Cloud Function foi escrita), então `--only functions,hosting` falharia de imediato — o Firebase CLI recusa alvos que não existem no projeto.

## Rotas da aplicação

Definidas em `src/routes/AppRoutes.tsx`, todas client-side (React Router).

### Públicas

| Rota | Página |
|---|---|
| `/` | `HomePage` — seleção de candidato / entrada |
| `/admin/login` | `AdminLoginPage` — login de administrador (e-mail/senha) |
| `/unauthorized` | Usuário autenticado sem permissão de admin |
| `/inactive` | Usuário/candidato desativado pelo admin |

### Candidato — `UserProtectedRoute` (exige sessão ativa)

| Rota | Página |
|---|---|
| `/app` | Redireciona para `/app/exams` |
| `/app/exams` | `ExamsPage` — provas atribuídas ao candidato |
| `/app/exams/:assignmentId` | `TakeExamPage` — realização da prova |
| `/app/attempts/:attemptId/result` | `ExamResultPage` — resultado/correção |
| `/app/history` | `HistoryPage` — histórico de tentativas |
| `/app/performance` | `PerformancePage` — desempenho por área/tema |

### Administração — `AdminProtectedRoute` (exige sessão ativa + `role === "admin"`)

| Rota | Página |
|---|---|
| `/admin` | Redireciona para `/admin/dashboard` |
| `/admin/dashboard` | `DashboardPage` |
| `/admin/users`, `/admin/users/:userId` | Gestão de usuários |
| `/admin/questions` | `QuestionsPage` — CRUD de questões + upload de imagem |
| `/admin/import` | `ImportPage` — importação em massa via JSON |
| `/admin/exams`, `/admin/exams/new`, `/admin/exams/:examId` | Listagem, criação e visualização de provas |
| `/admin/attempts` | `AttemptsPage` — tentativas de todos os candidatos |

`*` cai em `NotFoundPage`.

## Variáveis de ambiente e configuração

Ver `.env.example`:

```bash
# Usado apenas pelo servidor Express local (server.ts) para gerar questões via IA
GEMINI_API_KEY=

# Overrides opcionais da config do Firebase — hoje NÃO lidos por nenhum código
# (a config efetiva vem de firebase-applet-config.json, versionado na raiz)
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_FIRESTORE_DATABASE_ID=...

# Credenciais sugeridas para o primeiro admin (não há script de bootstrap que as consuma automaticamente)
FIRST_ADMIN_NAME=...
FIRST_ADMIN_EMAIL=...
FIRST_ADMIN_PASSWORD=...
```

No CI (GitHub Actions), o único secret consumido é `FIREBASE_TOKEN` (autenticação do `firebase-tools`) e `GEMINI_API_KEY` (não estritamente necessária para o build/deploy da Hosting).

## Rodando localmente

Pré-requisitos: Node.js 20+ (o CI usa Node 24) e, preferencialmente, [Bun](https://bun.sh) (o `bun.lock` é o lockfile oficial do repositório; `npm`/`yarn` também funcionam, mas gerarão seus próprios lockfiles).

```bash
# Instalar dependências
bun install        # ou: npm install

# Ambiente de desenvolvimento (Express + Vite middleware em http://localhost:3000)
bun run dev         # ou: npm run dev

# Type-check (sem emitir arquivos)
bun run lint         # ou: npm run lint

# Build de produção (gera dist/)
bun run build         # ou: npm run build
```

O modo `dev` não exige nenhum arquivo `.env` para o Firebase funcionar (a config já está em `firebase-applet-config.json`), mas para usar a geração de questões por IA localmente é preciso definir `GEMINI_API_KEY` no ambiente antes de rodar `bun run dev`.

## Scripts npm/bun

Definidos em `package.json`:

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `tsx server.ts` | Sobe o Express (`server.ts`) com Vite em modo middleware — usado só em desenvolvimento |
| `build` | `vite build` | Gera o bundle estático de produção em `dist/` (é o único passo executado no deploy real) |
| `start` | `node dist/server.cjs` | ⚠️ Ver [Pontos de atenção](#pontos-de-atenção--dívidas-técnicas-conhecidas) — não há mais um passo de build que gere `dist/server.cjs` |
| `lint` | `tsc --noEmit` | Checagem de tipos TypeScript, sem produzir saída |

## Pontos de atenção / dívidas técnicas conhecidas

Registradas aqui para quem for mexer no projeto em seguida:

1. **`npm start` está quebrado.** O script `build` foi simplificado para `vite build` puro (commit *"fix: simplifica script de build removendo dependencia do server.ts"*), mas o script `start` ainda espera `dist/server.cjs` — que só existia quando `build` também rodava `esbuild server.ts --bundle ... --outfile=dist/server.cjs`. Hoje esse arquivo nunca é gerado, então `npm run start` falha. Isso não afeta o deploy real (que usa só `--only hosting` servindo `dist/` estático via Firebase Hosting, não via Express), mas quebra qualquer expectativa de "rodar em produção via Node/Express".
2. **Dois arquivos de tipos do domínio divergentes**: `src/types.ts` e `src/types/index.ts` coexistem com definições parecidas, porém não idênticas, para as mesmas entidades (`Question`, `Exam`, `UserStats` etc.) — em alguns pontos com nulabilidade/obrigatoriedade diferentes (ex.: `imageUrl?: string` vs `imageUrl: string | null`). Módulos diferentes importam de um ou de outro; vale unificar em um único arquivo/pasta de tipos para evitar divergência silenciosa.
3. **Regras de Segurança do Firestore/Storage não estão versionadas** neste repositório (não há `firestore.rules`/`storage.rules`/`firestore.indexes.json`). Elas existem apenas no console do Firebase, o que significa que mudanças nelas não passam por revisão de código nem ficam auditáveis via git.
4. **Duas convenções de caminho de imagem no Storage** (`question-images/{questionId}/...` gerado pela UI vs. `imagens_questoes/{PROVA}/...` de uploads manuais em lote) — sem um importador único que normalize isso; hoje depender de ambos exige atenção manual ao popular `imageUrl` em `questions`.
5. **`VITE_FIREBASE_*` em `.env.example`/`vite-env.d.ts` são vestigiais** — nenhum código lê `import.meta.env.VITE_FIREBASE_*` hoje; a config efetiva vem de `firebase-applet-config.json`. Se a intenção é permitir múltiplos ambientes (dev/staging/prod) via env vars, essa integração ainda precisa ser feita em `src/services/firebase.ts`.
6. **`GEMINI_API_KEY`/geração de questões por IA só existe no `server.ts`** (Express), que não roda em produção (Hosting estático). Ou seja, o recurso de gerar questões via Gemini descrito em `server.ts` não está disponível no app publicado — só localmente via `bun run dev`.
7. **`vite.config.ts` precisa manter o plugin `tailwindcss()` registrado.** Uma regressão recente (ver histórico abaixo) removeu esse plugin do array `plugins`, quebrando toda a geração de classes utilitárias do Tailwind no build de produção (o CSS gerado passava a conter a diretiva `@tailwind utilities;` **não processada**, resultando em uma tela sem nenhum estilo aplicado). Já corrigido, mas fica registrado como algo a não repetir.

## Histórico relevante recente

- **Migração de imagens de questões de URLs externas (Imgur/Flickr) para Firebase Storage nativo.** Motivação: URLs externas são frágeis (podem expirar, sofrer *hotlinking block*, sumir) e não versionam CORS/permissões de forma previsível. Passou a existir upload direto para o bucket `gen-lang-client-0316191622.firebasestorage.app`, tanto via UI administrativa (`uploadQuestionImage`, path `question-images/{questionId}/...`) quanto via upload manual em lote (path `imagens_questoes/{PROVA}/...`, ex. o lote `TEOT_ANATOMIA_2024`). O componente `QuestionImage.tsx` foi refeito nesse processo para lidar com esses casos e com *fallback* visual em caso de falha de carregamento.
- **Regressão e correção: tela em branco na URL de Hosting.** Durante essa mesma leva de mudanças, uma refatoração de `vite.config.ts` (*"Refactor Vite configuration for deployment"*) removeu por engano o plugin `@tailwindcss/vite`, enquanto `src/index.css` continuava dependendo dele (`@import "tailwindcss";`, sintaxe do Tailwind v4). O build passava sem erros, mas o CSS de produção saía sem nenhuma classe utilitária real — o app renderizava (React montava normalmente), porém completamente sem estilo/layout, dando a impressão de "tela branca". A correção reintroduziu o plugin em `vite.config.ts` e também endureceu o capturador global de erros em `index.html` (passou a registrar o listener de `error` em fase de *capture*, capaz de detectar falhas de carregamento de `<script>`, que não se propagam em fase de *bubbling*).
- **Pasta local `public/imagens_questoes/...`** (imagens que chegaram a ser versionadas dentro do próprio projeto Vite, servidas como arquivos estáticos do build) foi removida do repositório após a migração para o Storage — deixou de fazer sentido manter imagens versionadas no bundle do frontend quando elas já vivem no Storage.
