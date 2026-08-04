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
4. [Design system (paleta e tipografia)](#design-system-paleta-e-tipografia)
5. [Firebase — visão geral do projeto](#firebase--visão-geral-do-projeto)
6. [Firebase Authentication](#firebase-authentication)
7. [Firestore — modelo de dados](#firestore--modelo-de-dados)
8. [Firebase Storage — imagens das questões](#firebase-storage--imagens-das-questões)
9. [Regras de Segurança (Firestore/Storage)](#regras-de-segurança-firestorestorage)
10. [Firebase Hosting e deploy (CI/CD)](#firebase-hosting-e-deploy-cicd)
11. [Rotas da aplicação](#rotas-da-aplicação)
12. [Variáveis de ambiente e configuração](#variáveis-de-ambiente-e-configuração)
13. [Rodando localmente](#rodando-localmente)
14. [Scripts npm/bun](#scripts-npmbun)
15. [Pontos de atenção / dívidas técnicas conhecidas](#pontos-de-atenção--dívidas-técnicas-conhecidas)
16. [Histórico relevante recente](#histórico-relevante-recente)

---

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework UI | React 18 + TypeScript |
| Roteamento | React Router DOM v7 (`BrowserRouter`) |
| Build/Bundler | Vite 6 (`@vitejs/plugin-react`) |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Ícones | lucide-react |
| Gráficos | recharts |
| Validação | zod |
| Backend/dados | Firebase (Auth, Firestore, Storage, Hosting) |
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

O app é um SPA **100% estático**: `vite build` gera `dist/`, e o Firebase Hosting serve esse diretório, redirecionando qualquer rota para `index.html` (roteamento fica todo no cliente, via React Router). Todo acesso a dados é feito **diretamente do navegador** para o Firestore/Storage através do SDK cliente do Firebase (`firebase` npm package) — **não existe nenhum servidor de aplicação próprio**, nem em desenvolvimento nem em produção. Não há API intermediária, backend Node/Express, nem função serverless custom neste repositório.

## Estrutura de pastas

```
bancoQuestoesApp/
├── .github/workflows/deploy.yml   # CI: build + deploy no Firebase Hosting (push em main)
├── firebase.json                  # Config do Firebase Hosting/Firestore/Storage
├── firestore.rules                # Regras de Segurança do Firestore (ver seção dedicada)
├── storage.rules                  # Regras de Segurança do Storage (ver seção dedicada)
├── .firebaserc                    # Projeto Firebase padrão (gen-lang-client-0316191622)
├── firebase-applet-config.json    # Config pública do Firebase Web App (apiKey, projectId, etc.)
├── vite.config.ts                 # Build do frontend (React + Tailwind)
├── index.html                     # Entry HTML (com capturador global de erros)
├── metadata.json                  # Metadados do app (nome, descrição)
├── arvore_temas.json              # Árvore estática de áreas/temas de ortopedia (usada em ImportPage como banco padrão para importação)
├── .env.example                   # Modelo de variáveis de ambiente
├── scripts/
│   └── import-question-images.mjs # Importador em lote de imagens para o Storage (ver seção Firebase Storage)
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
    ├── components/                # QuestionImage e QuestionPreviewModal (únicos componentes reutilizáveis em uso)
    ├── services/
    │   ├── firebase.ts            # Inicialização do Firebase App/Auth/Firestore/Storage
    │   ├── firebaseService.ts     # Toda a camada de acesso a dados (Firestore + Storage)
    │   ├── authService.ts         # Login admin (email/senha) e "login" de candidato (seleção de usuário)
    │   ├── gradingService.ts      # Correção de provas e atualização de estatísticas agregadas
    │   └── importService.ts       # Importação em massa de banco de questões via JSON
    ├── firebase/config.ts         # Reexporta app/auth/db/storage/firebaseConfig para o resto do app
    ├── schemas/index.ts           # Schemas Zod (validação de payloads, ex.: importação)
    ├── types.ts                   # Definições de tipos TypeScript do domínio (fonte única — ver histórico)
    └── utils/helpers.ts           # normalizeText, generateId, shuffleArray, formatDate, exportToCSV...
```

## Design system (paleta e tipografia)

A interface segue um sistema de design institucional próprio, com fundo predominantemente branco/claro, tipografia condensada em destaques e três cores-base:

| Papel | Cor | Uso |
|---|---|---|
| Dominante | `#050F41` (azul institucional) | Texto primário, navegação, cabeçalhos, botões de ação principal |
| Acento de alta visibilidade | `#FAB932` (âmbar/dourado) | Destaques pontuais, estado ativo em navegação sobre fundo escuro, badges — nunca como texto sobre fundo branco |
| Acento positivo | `#079551` (verde) | Confirmações, respostas corretas, indicadores de progresso |

Implementação: em vez de recolorir cada componente individualmente, `src/index.css` redefine os *tokens* de cor do Tailwind v4 via `@theme` (`--color-slate-*`, `--color-teal-*`, `--color-amber-*`, `--color-emerald-*`, `--color-cyan-*`, `--color-red-*`), de forma que toda a aplicação passe a usar essa paleta automaticamente a partir das mesmas classes utilitárias já existentes no código (`bg-slate-900`, `text-teal-400` etc.). A escala `slate` é deliberadamente invertida em relação ao Tailwind padrão (950 = claro/fundo, 100 = escuro/texto) porque o app já usava esses tokens como "texto claro sobre fundo escuro"; aqui a mesma relação passa a produzir "texto escuro sobre fundo claro".

Alguns elementos de *chrome* (cabeçalho e barra lateral de `UserLayout`/`AdminLayout`, telas de entrada como `HomePage`/`AdminLoginPage`, *backdrops* de modal e do visualizador de imagem em tela cheia) usam a cor institucional explicitamente (`bg-[#050f41]`) em vez do token remapeado, porque essas áreas devem permanecer escuras propositalmente (marca/navegação e *scrims* de modal), diferentemente do restante do conteúdo, que é claro.

Tipografia: **Montserrat** (via Google Fonts) é a fonte principal para corpo de texto, formulários, tabelas e a maioria dos títulos; **Bebas Neue** (condensada) é usada apenas em `<h1>` — títulos curtos e de destaque — com Montserrat como *fallback* automático caso a fonte não carregue. Ver `index.html` (`<link>` do Google Fonts) e `src/index.css` (`--font-sans`, `--font-display`).

## Firebase — visão geral do projeto

| Item | Valor |
|---|---|
| **Project ID** | `gen-lang-client-0316191622` |
| **Auth Domain** | `gen-lang-client-0316191622.firebaseapp.com` |
| **App ID (Web)** | `1:1001740918051:web:5d931926acb0883d160096` |
| **Firestore Database ID** | `ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6` (⚠️ **não é** o banco `(default)`) |
| **Storage Bucket** | `gen-lang-client-0316191622.firebasestorage.app` |
| **Hosting (URL pública)** | `https://gen-lang-client-0316191622.web.app` |

A configuração pública do Web App fica versionada em **`firebase-applet-config.json`** na raiz do repo e é importada por `src/services/firebase.ts`:

```ts
import firebaseConfigJson from "../../firebase-applet-config.json";

// VITE_FIREBASE_* (ver .env.example) funcionam como overrides opcionais —
// se não definidas, cai no config commitado abaixo.
export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  // ...
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId); // banco nomeado, não o (default)
export const storage = getStorage(app);
```

> A `apiKey` do Firebase Web App **não é secreta** por design (ela apenas identifica o projeto ao SDK cliente) — a segurança real dos dados é garantida pelas **Regras de Segurança** do Firestore/Storage, agora versionadas em `firestore.rules`/`storage.rules` (ver [seção dedicada](#regras-de-segurança-firestorestorage)).

## Firebase Authentication

O app usa um modelo **híbrido** de identidade, combinando Firebase Auth com um cadastro de usuários próprio no Firestore (coleção `users`):

- **Candidatos (`role: "user"`)** não digitam senha. O fluxo (`HomePage` → `authService.loginUserBySelection`) é: o candidato escolhe seu nome numa lista de usuários ativos cadastrados pelo admin, o app grava o `userId` selecionado em `localStorage` (`teot_active_session_user_id`) e autentica no Firebase via **login anônimo** (`signInAnonymously`) apenas para satisfazer as Regras de Segurança do Firestore/Storage (que exigem `request.auth != null`).
- **Administradores (`role: "admin"`)** fazem login com e-mail/senha reais (`AdminLoginPage` → `authService.loginAdminWithPassword`), usando `signInWithEmailAndPassword`. Há lógica de auto-bootstrap: se o e-mail ainda não existir no Firebase Auth, o app tenta criar a conta na hora (`createUserWithEmailAndPassword`) e, se não existir documento correspondente em `users`, cria um automaticamente com `role: "admin"`.
- `firebaseService.ensureAdminUserExists()` roda automaticamente ao carregar o módulo de serviços e garante a existência de um admin "seed" (`usr_mauriston_admin`, e-mail `mauriston@oncoortopedia.com`) na coleção `users`.
- `AuthContext` (`src/contexts/AuthContext.tsx`) é a fonte de verdade do usuário logado na UI: ele lê o `userId` da sessão local, busca o documento correspondente em `users` no Firestore, e também escuta `onAuthStateChanged` do Firebase Auth para re-sincronizar.
- `AppRoutes.tsx` implementa dois *route guards*: `UserProtectedRoute` (exige `currentUser.active`) e `AdminProtectedRoute` (exige adicionalmente `role === "admin"`), redirecionando para `/`, `/inactive` ou `/unauthorized` conforme o caso.

> Ou seja: o Firebase Auth garante que toda sessão (mesmo de candidato) tenha um `request.auth` válido perante as Regras de Segurança, mas a **autorização de negócio** (quem é admin, quem está ativo) é decidida pelo documento em `users` no Firestore, não por *custom claims* do Firebase Auth. **Importante**: sessões de candidato (Auth anônimo) nunca persistem o vínculo entre o `authUid` anônimo gerado pelo Firebase e o `AppUser.id` correspondente — ver a limitação detalhada em [Regras de Segurança](#regras-de-segurança-firestorestorage).

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

1. **`question-images/{questionId}/{timestamp}.{ext}`** — caminho **canônico**, gerado automaticamente pelo upload feito na UI administrativa (`firebaseService.uploadQuestionImage`, usado em `QuestionsPage`). O admin escolhe um arquivo de imagem ao criar/editar uma questão, o app faz `uploadBytes` para esse caminho e grava a `getDownloadURL()` resultante no campo `imageUrl` do documento em `questions`.
2. **`imagens_questoes/{PROVA}/{ARQUIVO}`** (ex.: `imagens_questoes/TEOT_ANATOMIA_2024/TEOT-2024-ANATOMIA-Q01.jpeg`) — convenção usada para **lotes de imagens enviados em conjunto** ao Storage (fora do fluxo de upload individual da UI), como parte da migração das questões que antes referenciavam imagens hospedadas em serviços externos (Imgur, Flickr) via URL direta no campo `imageUrl`. Esse caminho é alimentado por `scripts/import-question-images.mjs` (ver abaixo), que já cuida de gravar a URL pública correspondente no campo `imageUrl` de cada `question` — não é mais necessário fazer esse casamento manualmente.

> **Recomendação de uso**: para adicionar/editar a imagem de **uma** questão, use o fluxo 1 (upload pela UI de `QuestionsPage`). Para importar um **lote** de imagens já rotuladas por número de questão de uma prova inteira (ex.: um PDF de prova escaneado e recortado em uma imagem por questão), use `scripts/import-question-images.mjs`.

### Importação em lote de imagens (`scripts/import-question-images.mjs`)

Script Node (`firebase-admin`) que envia um conjunto de arquivos de imagem para `imagens_questoes/{PROVA}/{arquivo}` e atualiza o campo `imageUrl` de cada `questions/{id}` correspondente, a partir de um arquivo de mapeamento `{ "<questionId>": "<nomeDoArquivo>" }`.

```bash
npm install   # garante a dependência firebase-admin (devDependency)

# Pré-visualizar sem gravar nada:
npm run import:images -- --prova TEOT_TEORICA_2022 --dir ./imagens --map ./mapeamento.json --dry-run --key ./service-account.json

# Executar de verdade:
npm run import:images -- --prova TEOT_TEORICA_2022 --dir ./imagens --map ./mapeamento.json --key ./service-account.json
```

Requer credenciais de administrador do projeto Firebase (`firebase login` local, ou uma Service Account Key baixada do Console do Firebase e passada via `--key`/`GOOGLE_APPLICATION_CREDENTIALS`) — **nunca versione essa chave no repositório**. Detalhes completos de uso no cabeçalho do próprio arquivo.

Independentemente da origem, todo campo `imageUrl` do domínio é tratado como uma **URL absoluta e pronta para uso** (`<img src={question.imageUrl}>`), consumida diretamente em:

- `TakeExamPage` e `ExamResultPage` (tela do candidato) — `<img>` simples com clique para ampliar em modal.
- `QuestionImage.tsx` (componente reutilizável usado no back-office: `QuestionPreviewModal` e `ExamViewPage` do admin) — inclui *fallback* visual (`onError`) com link "Abrir link da imagem" caso o carregamento falhe.

> **CORS do bucket**: como as imagens do Storage são carregadas via tag `<img>` comum (não via SDK do Storage), o navegador as busca como um recurso cross-origin normal. `storage.rules` (ver abaixo) libera leitura pública desses dois caminhos propositalmente, exatamente para que esse carregamento via `<img>` funcione sem autenticação.

## Regras de Segurança (Firestore/Storage)

Até recentemente, as Regras de Segurança do Firestore e do Storage **não estavam versionadas neste repositório** — existiam só no console do Firebase, fora de qualquer revisão de código ou histórico auditável. Isso agora está corrigido: `firestore.rules` e `storage.rules` foram adicionados na raiz do projeto e referenciados em `firebase.json` (chaves `firestore.rules` e `storage.rules`, com `firestore.database` apontando para o banco nomeado do projeto).

**Importante**: esses arquivos foram escritos a partir do comportamento observado no código (quais telas leem/escrevem cada coleção, e se isso acontece antes ou depois de qualquer login) — **não foram extraídos das regras hoje publicadas** no console do Firebase, já que este ambiente de desenvolvimento não tem acesso às credenciais do projeto para fazer esse `diff`. Antes do primeiro `firebase deploy --only firestore:rules,storage:rules`, é preciso comparar manualmente estes arquivos com o que está publicado hoje — o deploy do Hosting (CI) continua rodando com `--only hosting` e **não** publica essas regras automaticamente, então adicioná-las aqui não muda nada em produção até alguém rodar esse deploy deliberadamente.

A política adotada nos dois arquivos é a linha de base alcançável hoje, dada a arquitetura atual do app: **qualquer leitura/escrita exige uma sessão do Firebase Auth** (`request.auth != null` — anônima ou de admin), com duas exceções propositais para leitura pública:

- Coleção `users` no Firestore — a tela inicial (`HomePage`) precisa listar candidatos ativos **antes** de qualquer login/Auth anônimo.
- Caminhos `question-images/**` e `imagens_questoes/**` no Storage — as imagens são carregadas via `<img src>` comum, inclusive em telas que podem abrir sem sessão prévia.

Duas limitações arquiteturais **não são resolvidas só por essas regras** (documentadas em detalhe nos comentários de `firestore.rules`):

1. **O gabarito é lido do navegador.** `gradingService.ts` roda inteiramente no cliente — não há Cloud Function fazendo a correção. Isso significa que qualquer sessão autenticada (inclusive anônima) consegue, tecnicamente, ler `questionAnswers/{questionId}` de **qualquer** questão via SDK, não só da questão que está sendo respondida no momento. Resolver isso de verdade exigiria mover a correção para uma Cloud Function que seja a única com permissão de leitura sobre `questionAnswers`.
2. **Não há isolamento real por dono do documento.** `examAssignments.userId`, `attempts.userId` etc. guardam o ID interno do app (`users/{id}`), não `request.auth.uid` — e sessões de candidato (Auth anônimo) nunca persistem o vínculo entre o `authUid` anônimo e o `AppUser.id`. Por isso não é possível, hoje, escrever uma regra do tipo "só o dono pode ler/escrever sua própria tentativa" — qualquer sessão autenticada tem acesso equivalente a qualquer outra. Corrigir isso exigiria persistir esse vínculo no login (gravar `authUid` no documento do usuário a cada `signInAnonymously`) e usar `get()` nas regras para conferi-lo.

## Firebase Hosting e deploy (CI/CD)

`firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "database": "ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6",
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- `public: "dist"` — a Hosting serve exatamente o que `vite build` gera em `dist/` (HTML + JS/CSS com hash + assets).
- O `rewrite` `"**" → "/index.html"` é o padrão de SPA: qualquer caminho sem correspondência de arquivo estático real cai no `index.html`, e o React Router assume o roteamento no cliente. Arquivos estáticos existentes em `dist/` (JS, CSS, favicon etc.) têm prioridade sobre esse rewrite — comportamento padrão do Firebase Hosting.
- As chaves `firestore`/`storage` apontam para os arquivos de regras (ver seção anterior) — elas só são usadas quando alguém roda `firebase deploy --only firestore:rules,storage:rules` manualmente; o workflow de CI não as toca.
- `.firebaserc` fixa o projeto padrão (`gen-lang-client-0316191622`), então `firebase deploy` não precisa de `--project` quando rodado localmente com o CLI autenticado (o workflow de CI passa `--project` explicitamente por segurança/clareza).

**Deploy automático** (`.github/workflows/deploy.yml`), disparado a cada `push` na branch **`main`**:

1. Checkout do repositório.
2. Setup de Node 24 e Bun.
3. `bun install`.
4. `bun run build` (→ `vite build`, gera `dist/`).
5. Instala `firebase-tools` globalmente.
6. `firebase deploy --only hosting --project gen-lang-client-0316191622`, autenticado via secret `FIREBASE_TOKEN` do repositório.

> O deploy é `--only hosting` propositalmente: o projeto **não tem uma pasta `functions/`** (nenhuma Cloud Function foi escrita), então `--only functions,hosting` falharia de imediato — o Firebase CLI recusa alvos que não existem no projeto. As regras de Firestore/Storage (`firestore.rules`/`storage.rules`) também não fazem parte deste deploy automático — ver ressalva na seção anterior.

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
# Overrides opcionais da config do Firebase (default: firebase-applet-config.json).
# Defina estas variáveis só se quiser apontar o build para outro projeto
# Firebase (ex.: um ambiente de staging separado).
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

`VITE_FIREBASE_*` já são lidas de verdade por `src/services/firebase.ts` (`import.meta.env.VITE_FIREBASE_*`), como overrides opcionais sobre o `firebase-applet-config.json` commitado — se não definidas, o app usa normalmente a config do projeto padrão.

No CI (GitHub Actions), o único secret consumido é `FIREBASE_TOKEN` (autenticação do `firebase-tools` para o deploy do Hosting).

## Rodando localmente

Pré-requisitos: Node.js 20+ (o CI usa Node 24) e, preferencialmente, [Bun](https://bun.sh) (o `bun.lock` é o lockfile oficial do repositório; `npm`/`yarn` também funcionam, mas gerarão seus próprios lockfiles).

```bash
# Instalar dependências
bun install        # ou: npm install

# Ambiente de desenvolvimento (Vite dev server em http://localhost:5173)
bun run dev         # ou: npm run dev

# Type-check (sem emitir arquivos)
bun run lint         # ou: npm run lint

# Build de produção (gera dist/)
bun run build         # ou: npm run build

# Servir o build de produção localmente, para conferência antes do deploy
bun run preview         # ou: npm run preview
```

Nenhum arquivo `.env` é necessário para o Firebase funcionar em desenvolvimento — a config já está em `firebase-applet-config.json`.

## Scripts npm/bun

Definidos em `package.json`:

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `vite` | Sobe o servidor de desenvolvimento do Vite (hot reload) |
| `build` | `vite build` | Gera o bundle estático de produção em `dist/` (é o único passo executado no deploy real) |
| `preview` | `vite preview` | Serve `dist/` localmente, para conferir o build de produção antes do deploy |
| `lint` | `tsc --noEmit` | Checagem de tipos TypeScript, sem produzir saída |
| `import:images` | `node scripts/import-question-images.mjs` | Importação em lote de imagens de questões para o Storage (ver [Firebase Storage](#firebase-storage--imagens-das-questões)) |

## Pontos de atenção / dívidas técnicas conhecidas

Os itens abaixo foram identificados numa revisão anterior e já foram endereçados; ficam registrados aqui como referência do que foi decidido e por quê.

1. ~~`npm start` estava quebrado~~ — **resolvido**: o app nunca teve (nem precisa de) um servidor Node/Express em produção — o Firebase Hosting já serve o `dist/` estático diretamente. O `server.ts` (Express, usado só localmente para modo dev + endpoint de geração de questões por IA) foi removido por completo junto com a funcionalidade de IA (ver item 6). `dev` agora roda o Vite diretamente (`vite`) e existe um script `preview` (`vite preview`) para conferir o build de produção localmente — sem depender de Express/Node custom nem de um passo de bundling que não existia mais.
2. ~~Dois arquivos de tipos do domínio divergentes~~ — **resolvido**: `src/types/index.ts` nunca era de fato importado por nenhum módulo (toda importação usava o caminho relativo `../types`, que a resolução de módulos do TypeScript/Node satisfaz primeiro com o arquivo `types.ts`, antes de considerar o diretório `types/`) — ou seja, era código morto. Ele foi removido, e `src/types.ts` passou a ser a única fonte de tipos do domínio. De quebra, os campos "legados" do tipo `Question` (`area`, `tema`, `enunciado`, `opcoes`, `respostaCorreta`, `explicacao`, `pontosChave`, `referencia`) e os tipos `AreaTema`, `QuizAttempt`, `SavedQuestion`, `Flashcard`, `QuestionAnswerLog` também saíram — existiam só para dar suporte ao protótipo de "quiz livre com IA" removido no item 6.
3. ~~Regras de Segurança do Firestore/Storage não versionadas~~ — **resolvido**: ver [seção dedicada](#regras-de-segurança-firestorestorage) acima (`firestore.rules`/`storage.rules`). Continuam existindo duas limitações arquiteturais que as regras sozinhas não resolvem (gabarito lido do cliente; sem isolamento real por dono do documento) — documentadas na mesma seção.
4. ~~Duas convenções de caminho de imagem no Storage sem importador único~~ — **parcialmente resolvido**: `question-images/{questionId}/...` (upload individual pela UI) e `imagens_questoes/{PROVA}/...` (lotes por prova) continuam coexistindo — são casos de uso genuinamente diferentes, não um bug —, mas agora existe `scripts/import-question-images.mjs` para popular o segundo caminho de forma consistente (upload + `imageUrl` sempre no mesmo passo, sem casamento manual). Ver [Firebase Storage](#firebase-storage--imagens-das-questões).
5. ~~`VITE_FIREBASE_*` vestigiais~~ — **resolvido**: `src/services/firebase.ts` agora lê `import.meta.env.VITE_FIREBASE_*` como overrides reais sobre `firebase-applet-config.json`, permitindo apontar um build para outro projeto Firebase (ex.: staging) só com variáveis de ambiente, sem editar código.
6. ~~Geração de questões por IA (`GEMINI_API_KEY`/`server.ts`)~~ — **removida por completo**, a pedido: nunca esteve disponível no app publicado (só funcionava localmente via `server.ts`/Express, que não roda em produção), então mantinha código morto e uma dependência (`@google/genai`) sem uso real. Foram removidos: `server.ts`; `POST /api/generate-questions`; a dependência `@google/genai`, `express` e `@types/express`; a variável `GEMINI_API_KEY` (`.env.example`, `.github/workflows/deploy.yml`); `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` (`metadata.json`); e todo o cluster de UI que só existia para consumir esse endpoint e nunca esteve conectado a nenhuma rota real do app (`QuizEngine.tsx`, `QuizResultView.tsx`, `StatsView.tsx`, `FlashcardsView.tsx`, `SavedQuestionsView.tsx`, `ArvoreTemasView.tsx`, `Header.tsx` e `src/data/prebakedQuestions.ts` — nenhum desses componentes era importado por `AppRoutes.tsx` ou por qualquer página em uso). As dependências `canvas-confetti` e `tsx`, usadas apenas por esse mesmo cluster morto, também saíram do `package.json`.
7. **`vite.config.ts` precisa manter o plugin `tailwindcss()` registrado.** Uma regressão anterior removeu esse plugin do array `plugins`, quebrando toda a geração de classes utilitárias do Tailwind no build de produção (o CSS gerado passava a conter a diretiva `@tailwind utilities;` **não processada**, resultando em uma tela sem nenhum estilo aplicado). Já corrigido, mas fica registrado como algo a não repetir.

## Histórico relevante recente

- **Migração de imagens de questões de URLs externas (Imgur/Flickr) para Firebase Storage nativo.** Motivação: URLs externas são frágeis (podem expirar, sofrer *hotlinking block*, sumir) e não versionam CORS/permissões de forma previsível. Passou a existir upload direto para o bucket `gen-lang-client-0316191622.firebasestorage.app`, tanto via UI administrativa (`uploadQuestionImage`, path `question-images/{questionId}/...`) quanto via upload manual em lote (path `imagens_questoes/{PROVA}/...`, ex. o lote `TEOT_ANATOMIA_2024`). O componente `QuestionImage.tsx` foi refeito nesse processo para lidar com esses casos e com *fallback* visual em caso de falha de carregamento.
- **Regressão e correção: tela em branco na URL de Hosting.** Durante essa mesma leva de mudanças, uma refatoração de `vite.config.ts` (*"Refactor Vite configuration for deployment"*) removeu por engano o plugin `@tailwindcss/vite`, enquanto `src/index.css` continuava dependendo dele (`@import "tailwindcss";`, sintaxe do Tailwind v4). O build passava sem erros, mas o CSS de produção saía sem nenhuma classe utilitária real — o app renderizava (React montava normalmente), porém completamente sem estilo/layout, dando a impressão de "tela branca". A correção reintroduziu o plugin em `vite.config.ts` e também endureceu o capturador global de erros em `index.html` (passou a registrar o listener de `error` em fase de *capture*, capaz de detectar falhas de carregamento de `<script>`, que não se propagam em fase de *bubbling*).
- **Pasta local `public/imagens_questoes/...`** (imagens que chegaram a ser versionadas dentro do próprio projeto Vite, servidas como arquivos estáticos do build) foi removida do repositório após a migração para o Storage — deixou de fazer sentido manter imagens versionadas no bundle do frontend quando elas já vivem no Storage.
- **Remoção da geração de questões por IA e do código morto associado**, e das demais dívidas técnicas então identificadas: unificação dos tipos do domínio em `src/types.ts`, versionamento inicial de `firestore.rules`/`storage.rules`, e ativação real dos overrides `VITE_FIREBASE_*`. Ver item a item na seção [Pontos de atenção](#pontos-de-atenção--dívidas-técnicas-conhecidas) acima.
