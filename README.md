# Banco de Questões TEOT — HMA 2027

Aplicação web de estudo, simulados e gestão de banco de questões para a preparação do **TEOT** (Título de Especialista em Ortopedia e Traumatologia) e provas correlatas (**TARO**, SBOT), organizada segundo a árvore oficial de áreas e temas da especialidade.

O produto tem dois lados:

- **Área do residente (`/app/*`)** — responde as provas atribuídas, acompanha histórico e desempenho por área/tema/grupo, assiste aos materiais da Videoteca e das Aulas, revê as Sabatinas, consulta o cronograma do treinamento e as estatísticas históricas de TEOT/TARO.
- **Área administrativa (`/admin/*`)** — cadastra questões com gabarito, monta e publica provas, atribui e convida candidatos, acompanha tentativas e resultados ao vivo, gerencia usuários e importa conteúdo em massa.

Todo o backend é **serverless**, provido inteiramente pelo **Firebase** (Authentication, Firestore, Storage e Hosting) — não existe servidor de aplicação, API própria ou Cloud Function neste repositório.

> Nome exibido: **TEOT HMA 2027** — *"O ano da vitória 🏆"*

---

## Documentação

Este README cobre visão geral, operação e deploy. Os detalhes vivem em três documentos dedicados:

| Documento | Conteúdo |
|---|---|
| [`architecture.md`](architecture.md) | Camadas, mapa de módulos, fluxos ponta a ponta, tempo real, transações, limitações estruturais |
| [`database.md`](database.md) | Modelo de dados completo: 18 coleções + 3 subcoleções, campos, IDs, índices, Storage, Regras, cascatas |
| [`design.md`](design.md) | Sistema de design: tokens (e a escala invertida), tipografia, componentes, padrões de tela, movimento |

---

## Sumário

1. [Funcionalidades](#funcionalidades)
2. [Stack tecnológica](#stack-tecnológica)
3. [Arquitetura em alto nível](#arquitetura-em-alto-nível)
4. [Estrutura de pastas](#estrutura-de-pastas)
5. [Rodando localmente](#rodando-localmente)
6. [Scripts npm/bun](#scripts-npmbun)
7. [Variáveis de ambiente](#variáveis-de-ambiente)
8. [Projeto Firebase](#projeto-firebase)
9. [Autenticação e perfis](#autenticação-e-perfis)
10. [Rotas da aplicação](#rotas-da-aplicação)
11. [Modelo de dados (resumo)](#modelo-de-dados-resumo)
12. [Imagens de questões](#imagens-de-questões)
13. [Importação de conteúdo](#importação-de-conteúdo)
14. [Scripts de manutenção](#scripts-de-manutenção)
15. [Regras de Segurança](#regras-de-segurança)
16. [Deploy (CI/CD)](#deploy-cicd)
17. [Design system](#design-system)
18. [Pontos de atenção e dívidas técnicas](#pontos-de-atenção-e-dívidas-técnicas)

---

## Funcionalidades

### Residente

| Recurso | Descrição |
|---|---|
| **Home** | Saudação, carrossel de provas pendentes (ao vivo) e atalhos para todas as seções |
| **Provas** | Lista de provas atribuídas e ativas; atualiza sozinha quando o admin publica ou ativa uma |
| **Execução de prova** | Modo tela cheia, uma questão por vez, **sem voltar**, com rascunho salvo localmente e retomada automática de onde parou. Se a prova estiver configurada para embaralhar, cada candidato recebe uma ordem própria — estável entre retomadas |
| **Relatório** | Nota, desempenho por Área, por Grupo (TEOT) e por Tema, mais a revisão questão a questão com gabarito, comentários, mídia e referência bibliográfica |
| **Histórico** | Todas as tentativas, com nota colorida e ícone por faixa de desempenho |
| **Desempenho** | Ranking geral, taxa de acerto, evolução por prova, radar "você × colegas", donuts por Área e por Grupo, ranking de temas e os 5 temas críticos |
| **Sabatinas** | Apresentações do Google Slides agrupadas por data, com visualização em tela cheia e download em PDF |
| **Cronograma** | Calendário mensal e agenda dos 19 encontros do treinamento |
| **TEOT/TARO** | Estatísticas históricas do banco: questões por ano, áreas e temas mais cobrados, com filtros por prova, ano e área |
| **Extras** | Videoteca (YouTube) e Aulas (Canva/Google Slides), com marcação de "visto" e badge de não vistos |
| **Notificações** | Feed de eventos + pop-ups em tempo real + badge de não lidas |
| **Ajustes** | Foto de perfil, telefone/WhatsApp e troca de e-mail/senha |

### Administrador

| Recurso | Descrição |
|---|---|
| **Dashboard** | Ranking geral com drill-down por usuário, evolução do desempenho médio, desempenho por Área e por Grupo, 4 KPIs, últimas tentativas e exportação CSV — tudo ao vivo |
| **Banco de Questões** | CRUD completo, filtros por fonte/área/tema/texto, gabarito visível na lista, upload e remoção de imagem, pré-visualização com "já utilizada em" |
| **Provas** | Assistente em 4 etapas (dados → seleção → atribuição → revisão), edição de provas inativas e sem tentativas, ativar/desativar, exclusão em cascata |
| **Visão da prova** | Distribuição por área e tema com filtros cruzados, taxa de acerto por questão, tabela de respostas enviadas ao vivo, adicionar candidatos e **convidar por WhatsApp** |
| **Resultados** | Todas as tentativas de todos os candidatos, com busca e exclusão (revertendo as estatísticas) |
| **Usuários** | Cadastro, ativar/inativar, mudar perfil, excluir, foto, telefone e página de detalhe com desempenho e histórico |
| **Importar** | Banco de questões (JSON), grupos TEOT dos temas, imagens em lote e materiais via CSV |
| **Sabatinas / Extras** | Mesmas telas do residente, com criação, edição, exclusão e contadores de visualização |

---

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| UI | React 18 + TypeScript 5.7 |
| Roteamento | React Router DOM v7 (`BrowserRouter`) |
| Build | Vite 6 (`@vitejs/plugin-react`) |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`), tokens via `@theme` |
| Animação | framer-motion 13 |
| Ícones | lucide-react |
| Gráficos | recharts 2 |
| CSV | papaparse |
| Validação | zod 4 |
| Backend | Firebase 12 (Auth, Firestore, Storage, Hosting) |
| Scripts | firebase-admin 13 (Node ESM) |
| Pacotes | Bun (lockfile oficial: `bun.lock`) |
| CI/CD | GitHub Actions → Firebase Hosting |

---

## Arquitetura em alto nível

```
┌───────────────────────────┐        ┌──────────────────────────────────────┐
│   Navegador (SPA React)   │        │   Projeto Firebase                   │
│                           │        │   gen-lang-client-0316191622         │
│  index.html → main.tsx    │        │                                      │
│  → App → AuthProvider     │───────▶│   Auth       login admin/candidato   │
│  → AppRoutes              │        │   Firestore  dados (banco NOMEADO)   │
│     ├─ UserLayout         │        │   Storage    imagens e avatares      │
│     └─ AdminLayout        │        │   Hosting    serve o build estático  │
└───────────────────────────┘        └──────────────────────────────────────┘
```

O app é um SPA **100% estático**: `vite build` gera `dist/`, o Firebase Hosting serve esse diretório e redireciona qualquer rota para `index.html` (o roteamento é todo no cliente). Todo acesso a dados sai **direto do navegador** para o Firestore/Storage pelo SDK cliente. **Não há API intermediária nem Cloud Functions.**

Detalhes completos — fluxos, transações, tempo real e limitações — em [`architecture.md`](architecture.md).

---

## Estrutura de pastas

```
bancoQuestoesApp/
├── .github/workflows/deploy.yml   # CI: build + deploy no Hosting (push em main)
├── firebase.json                  # Hosting + apontamento das regras
├── .firebaserc                    # Projeto padrão
├── firebase-applet-config.json    # Config pública do Web App
├── firestore.rules                # Regras do Firestore (não publicadas pelo CI)
├── storage.rules                  # Regras do Storage (idem)
├── index.html                     # Entry HTML: fontes, PWA, OG, captura global de erros
├── vite.config.ts                 # React + Tailwind v4
├── metadata.json                  # Nome e descrição do app
├── arvore_temas.json              # Árvore oficial: 11 áreas, ~336 temas
├── public/
│   ├── manifest.webmanifest       # PWA (sem service worker)
│   ├── icons/                     # Ícones 192/512/maskable/apple-touch
│   └── social-preview.png         # Prévia de compartilhamento (1200×630)
├── design/icons/                  # Logos institucionais (fonte de marca)
├── reference/
│   ├── areas_grupos_temas.json    # Árvore Área → Grupo TEOT → Temas
│   ├── arvore_temas_subareas.json # Árvore antiga por subárea (histórico)
│   └── livros_referencia.csv      # Livros citáveis no gabarito
├── scripts/                       # 8 utilitários Node (firebase-admin)
└── src/
    ├── main.tsx  App.tsx  index.css
    ├── routes/AppRoutes.tsx       # Rotas + guards de acesso
    ├── contexts/AuthContext.tsx   # Sessão e usuário atual
    ├── layouts/                   # UserLayout, AdminLayout
    ├── pages/
    │   ├── HomePage · AdminLoginPage · RegisterPage · UnauthorizedPage
    │   ├── ExtrasPage · SabatinasPage · NotificationsPage   (compartilhadas)
    │   ├── app/                   # Home, Provas, Prova, Resultado, Histórico,
    │   │                          # Desempenho, Estatísticas, Cronograma, Ajustes
    │   └── admin/                 # Home, Dashboard, Usuários, Questões, Provas,
    │                              # Resultados, Importar, Imagens em Lote
    ├── components/                # 13 componentes reutilizáveis
    ├── hooks/                     # useUnreadNotifications, useUnseenExtrasCount,
    │                              # useHideOnScroll
    ├── services/
    │   ├── firebase.ts            # Init do SDK (banco nomeado + overrides)
    │   ├── firebaseService.ts     # Toda a camada de dados (CRUD + subscriptions)
    │   ├── authService.ts         # Login, cadastro, troca de credenciais
    │   ├── gradingService.ts      # Correção + agregação de estatísticas
    │   └── importService.ts       # Importação em massa (JSON + grupos)
    ├── firebase/config.ts         # Reexport de app/auth/db/storage
    ├── schemas/index.ts           # Schemas Zod
    ├── types.ts                   # Fonte única de tipos do domínio
    ├── constants.ts               # Fontes de prova, cronograma, chips
    └── utils/                     # helpers, mediaUrls, fileShare
```

---

## Rodando localmente

Pré-requisitos: **Node.js 20+** (o CI usa 24) e, preferencialmente, [Bun](https://bun.sh) — `bun.lock` é o lockfile oficial (`npm`/`yarn` funcionam, mas gerarão lockfiles próprios).

```bash
bun install        # ou: npm install
bun run dev        # Vite dev server → http://localhost:5173
bun run lint       # tsc --noEmit (type-check)
bun run build      # gera dist/
bun run preview    # serve dist/ para conferência antes do deploy
```

**Nenhum arquivo `.env` é necessário** — a configuração do Firebase já está em `firebase-applet-config.json`. O ambiente local aponta para o **projeto de produção**; não há projeto de staging configurado (as variáveis `VITE_FIREBASE_*` existem justamente para permitir criar um).

---

## Scripts npm/bun

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `vite` | Servidor de desenvolvimento com hot reload |
| `build` | `vite build` | Bundle de produção em `dist/` — único passo do deploy |
| `preview` | `vite preview` | Serve `dist/` localmente |
| `lint` | `tsc --noEmit` | Checagem de tipos (não emite arquivos) |
| `import:images` | `node scripts/import-question-images.mjs` | Importa imagens de questões em lote |
| `setup:user-passwords` | `node scripts/setup-user-passwords.mjs` | Cria contas no Auth para usuários legados |

Os demais scripts em `scripts/` são executados diretamente com `node` — ver [Scripts de manutenção](#scripts-de-manutenção).

---

## Variáveis de ambiente

Ver `.env.example`. Todas são **opcionais**:

```bash
# Overrides da config do Firebase (default: firebase-applet-config.json).
# Defina só para apontar o build para outro projeto (ex.: staging).
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_FIRESTORE_DATABASE_ID=...

# Sugestão de credenciais do primeiro admin — nenhum script as consome automaticamente
FIRST_ADMIN_NAME=...
FIRST_ADMIN_EMAIL=...
FIRST_ADMIN_PASSWORD=...
```

`VITE_FIREBASE_*` são lidas de verdade por `src/services/firebase.ts`, com *fallback* no JSON versionado.

No CI, o único secret consumido é **`FIREBASE_SERVICE_ACCOUNT`** (o JSON de uma Service Account com permissão de deploy no Hosting).

---

## Projeto Firebase

| Item | Valor |
|---|---|
| **Project ID** | `gen-lang-client-0316191622` |
| **Auth Domain** | `gen-lang-client-0316191622.firebaseapp.com` |
| **App ID (Web)** | `1:1001740918051:web:5d931926acb0883d160096` |
| **Firestore Database ID** | `ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6` ⚠️ **não é o `(default)`** |
| **Storage Bucket** | `gen-lang-client-0316191622.firebasestorage.app` |
| **URL pública** | `https://gen-lang-client-0316191622.web.app` |

A configuração pública fica em `firebase-applet-config.json`, importada por `src/services/firebase.ts`:

```ts
export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  // ...
};

export const app     = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth    = getAuth(app);
export const db      = getFirestore(app, firestoreDatabaseId); // banco NOMEADO
export const storage = getStorage(app);
```

> A `apiKey` do Web App **não é secreta** por design — ela apenas identifica o projeto para o SDK. A segurança real vem das [Regras de Segurança](#regras-de-segurança).

---

## Autenticação e perfis

Modelo **híbrido**: o Firebase Auth prova *quem você é*; o documento em `users` decide *o que você pode*.

- **Residentes (`role: "user"`)** — login com e-mail/senha reais na tela inicial. O app acha o documento em `users` pelo e-mail, confere `active`, autentica no Firebase e vincula o `authUid`. E-mail sem cadastro → a UI oferece `/cadastro`.
- **Cadastro público (`/cadastro`)** — cria o usuário com `active: false`, **sem** iniciar sessão. O acesso só é liberado depois que um admin ativa o usuário em `/admin/users`.
- **Administradores (`role: "admin"`)** — login pelo card "Área restrita" da tela inicial ou por `/admin/login`. Há bootstrap automático: se a conta ainda não existir no Firebase Auth, é criada; se não houver documento correspondente, também. Falha de rede **não** libera acesso.
- **Admin semente** — `usr_mauriston_admin` / `mauriston@oncoortopedia.com`, garantido no carregamento do módulo de serviços.
- **Troca de credenciais** — o próprio usuário altera e-mail e senha em Ajustes, reautenticando com a senha atual.
- **Usuários anteriores ao login por senha** não têm conta no Auth. Rode `npm run setup:user-passwords` uma vez para criá-las com a senha padrão `123456` (o usuário troca depois em Ajustes) e vincular o `authUid`.

Os guards ficam em `AppRoutes.tsx`: `UserProtectedRoute` (exige sessão ativa) e `AdminProtectedRoute` (exige adicionalmente `role === "admin"`), redirecionando para `/`, `/inactive` ou `/unauthorized`.

---

## Rotas da aplicação

Todas client-side (React Router), definidas em `src/routes/AppRoutes.tsx`.

### Públicas

| Rota | Página |
|---|---|
| `/` | `HomePage` — splash + login do residente + acesso "Área restrita" |
| `/cadastro` | `RegisterPage` — cadastro público (nasce inativo) |
| `/admin/login` | `AdminLoginPage` |
| `/unauthorized` | Autenticado sem permissão de admin |
| `/inactive` | Usuário desativado |
| `*` | `NotFoundPage` |

### Residente — `UserProtectedRoute`

| Rota | Página |
|---|---|
| `/app` | → `/app/home` |
| `/app/home` | Home com atalhos e provas pendentes |
| `/app/exams` | Provas atribuídas |
| `/app/exams/:assignmentId` | Execução da prova (tela cheia) |
| `/app/attempts/:attemptId/result` | Relatório da tentativa |
| `/app/history` | Histórico de tentativas |
| `/app/performance` | Desempenho e ranking |
| `/app/sabatinas` | Sabatinas |
| `/app/cronograma` | Cronograma do treinamento |
| `/app/exam-stats` | Estatísticas TEOT/TARO |
| `/app/extras` | Videoteca e Aulas |
| `/app/settings` | Ajustes do perfil |
| `/app/notifications` | Notificações |

### Administração — `AdminProtectedRoute`

| Rota | Página |
|---|---|
| `/admin` | → `/admin/home` |
| `/admin/home` | Atalhos do painel |
| `/admin/dashboard` | Dashboard analítico |
| `/admin/questions` | Banco de questões |
| `/admin/exams` | Lista de provas |
| `/admin/exams/new` | Assistente de criação |
| `/admin/exams/:examId/edit` | Edição (só prova inativa e sem tentativas) |
| `/admin/exams/:examId` | Visão detalhada da prova |
| `/admin/attempts` | Resultados de todos os candidatos |
| `/admin/users` · `/admin/users/:userId` | Usuários e detalhe |
| `/admin/import` | Importações (JSON, grupos, imagens, CSV) |
| `/admin/images` | → `/admin/import` (a tela foi incorporada lá) |
| `/admin/sabatinas` · `/admin/extras` | Mesmas telas do residente, em modo de gestão |
| `/admin/exam-stats` | Estatísticas TEOT/TARO |
| `/admin/settings` · `/admin/notifications` | Perfil e notificações |

---

## Modelo de dados (resumo)

**18 coleções de topo + 3 subcoleções.** Referência completa — campos, tipos, IDs, índices e cascatas — em [`database.md`](database.md).

| Coleção | Representa |
|---|---|
| `users` | Candidato ou administrador |
| `areas` · `themes` · `groups` | Taxonomia: área, tema e grupo oficial TEOT |
| `reference` | Livros citáveis no gabarito |
| `questions` | Questão pública (**sem** gabarito) |
| `questionAnswers` | Gabarito, comentário e referência (**ID = questionId**) |
| `exams` + `exams/{id}/questions` | Prova e a cópia **congelada** das questões |
| `examAssignments` | Atribuição prova ↔ candidato |
| `attempts` + `attempts/{id}/answers` | Tentativa e respostas |
| `userStats` | Agregado de desempenho (**ID = userId**) |
| `videotecaItems` · `aulaItems` · `materialViewLogs` | Extras e visualizações |
| `sabatinas` · `sabatinaViewLogs` | Sabatinas e visualizações |
| `notifications` · `notificationReads` | Feed de eventos e marcador "lido até" |
| `adminLogs` · `imports` | Auditoria |

### Duas hierarquias paralelas — não confunda

- **Área** (`areas`) — região anatômica/especialidade (Mão, Joelho, Coluna…). É o que **filtra questões** no banco e na criação de provas.
- **Grupo** (`groups`) — agrupamento oficial do TEOT (Anatomia, Ciência Básica, Ortopedia Adulto, Ortopedia Infantil, Trauma Adulto, Trauma Infantil, Oncologia Ortopédica). Um grupo **cruza várias áreas** e serve **exclusivamente para estatísticas** — nunca filtra questões.

Ambos se ligam ao **Tema**, que pertence a uma área e a um grupo.

### Ciclo de vida de uma prova

1. **Cadastro das questões** → `questions` (público) + `questionAnswers` (gabarito).
2. **Publicação** (`createAndPublishExam`) → cria `exams` (nascendo **inativa**), **congela** as questões em `exams/{id}/questions` e cria uma `examAssignment` por candidato — tudo em `writeBatch` comitado em blocos de ~400 operações.
3. **Ativação** pelo admin → a prova passa a aparecer para os candidatos; notificação `exam_activated`.
4. **Convite** (opcional) → link direto de WhatsApp com o `assignmentId`, marcando `invitedAt`.
5. **Início** (`startExamAttempt`) → em `runTransaction`, reaproveita a tentativa em andamento ou cria uma nova, e resolve a **ordem de apresentação** das questões (embaralhada por candidato quando `shuffleQuestions` está ligado — determinística a partir do `attemptId`, portanto estável na retomada e reproduzida no relatório).
6. **Respostas** → um documento por questão em `attempts/{id}/answers`, gravado a cada "Avançar".
7. **Correção** (`finishAndGradeAttempt`) → trava o status em `grading`, compara com o gabarito, calcula a nota e soma em `userStats` — tudo em transação, à prova de clique duplo e abas simultâneas.
8. **Exclusão** → `deleteExam()` e `deleteAttempt()` limpam dados órfãos e **revertem** o que a tentativa somou nas estatísticas.

O **congelamento** existe para que editar ou excluir uma questão do banco nunca altere uma prova já entregue.

### Configurações de prova

O assistente expõe três opções na Etapa 1 — e apenas essas três, porque são exatamente as que têm efeito:

| Opção | Padrão | Efeito |
|---|---|---|
| **Embaralhar ordem das questões para cada candidato** | desligado | Cada residente responde numa ordem própria, derivada do `attemptId`. A ordem se mantém se ele retomar a prova e é reproduzida no relatório final |
| **Permitir revisão questão a questão após finalizar** | ligado | Desmarcado, o candidato vê apenas a nota e o desempenho por área/tema/grupo |
| **Exibir gabarito e comentários na revisão** | ligado | Depende da opção anterior; inclui alternativa correta, comentário, mídia e referência bibliográfica |

A **nota e as análises de desempenho são sempre exibidas** ao final — não há opção para escondê-las. As alternativas **nunca** são embaralhadas.

---

## Imagens de questões

Bucket: `gen-lang-client-0316191622.firebasestorage.app`. Três caminhos, três casos de uso:

| Caminho | Origem |
|---|---|
| `question-images/{questionId}/{timestamp}.{ext}` | Upload individual pela UI (Banco de Questões) |
| `imagens_questoes/{fonte}/{arquivo}` | Lote por prova (tela Importar ou script) |
| `user-avatars/{userId}/{timestamp}.{ext}` | Foto de perfil |

O campo `imageUrl` guarda sempre a **URL absoluta** (`getDownloadURL()`), consumida por `<img src>` comum — por isso a leitura desses caminhos é pública nas Regras do Storage.

**Recomendação:** para **uma** questão, use o upload da UI (ou o botão de câmera na listagem, que aceita colar `Ctrl+V`). Para um **lote**, use a seção "Atualizar Imagens de Questões em Lote" em `/admin/import` — ou, para lotes muito grandes, o script Node.

### Lote pela UI (`/admin/import`)

1. Informe a **fonte** (ex.: `TEOT 2024`) — vira a subpasta em `imagens_questoes/{fonte}/`.
2. Selecione a **pasta inteira** do computador.
3. Cada arquivo precisa se chamar exatamente `<idDaQuestão>.jpeg` / `.jpg` / `.png` — o nome **é** o mapeamento. Outras extensões são ignoradas.
4. O resultado é listado arquivo a arquivo (vinculada / questão não encontrada / erro), com resumo final e registro em `adminLogs`.

### Lote por script

```bash
npm install

# Pré-visualizar sem gravar:
npm run import:images -- --prova TEOT_TEORICA_2022 --dir ./imagens \
  --map ./mapeamento.json --dry-run --key ./service-account.json

# Executar:
npm run import:images -- --prova TEOT_TEORICA_2022 --dir ./imagens \
  --map ./mapeamento.json --key ./service-account.json
```

O mapeamento é um JSON `{ "<questionId>": "<nomeDoArquivo>" }`. Exige credencial de administrador do projeto.

---

## Importação de conteúdo

Tudo concentrado em **`/admin/import`**:

| Seção | Entrada | Efeito |
|---|---|---|
| **Banco de Questões (JSON)** | Arquivo ou a árvore integrada (`arvore_temas.json`) | Cria `areas`, `themes`, `questions` e `questionAnswers` em lote, com barra de progresso e log em `imports` |
| **Grupos (TEOT) dos Temas** | Arquivo ou `reference/areas_grupos_temas.json` | Grava `groupId`/`groupName` nos temas existentes e propaga às questões. **Não cria** áreas, temas, questões ou grupos; reporta o que não casou |
| **Imagens em Lote** | Pasta de imagens | Ver seção anterior |
| **Videoteca / Aulas (CSV)** | CSV com `titulo, area, tema, url` | Cadastra vários materiais de uma vez; múltiplos temas separados por `;` |

O formato aceito pelo importador JSON é `{ dados: [{ Área, temas: [{ Tema, questoes: [...] }] }] }`, com várias variações de capitalização suportadas.

---

## Scripts de manutenção

Em `scripts/`, todos com `--dry-run` e exigindo credencial de administrador do Firebase — `firebase login` na mesma máquina **ou** uma Service Account Key via `--key` / `GOOGLE_APPLICATION_CREDENTIALS`.

> ⚠️ **Nunca versione a Service Account Key** nem a envie por canal que fique registrado — ela dá acesso total de administrador ao projeto.

| Script | O que faz |
|---|---|
| `import-question-images.mjs` | Lote de imagens → Storage + `imageUrl` |
| `import-questions-csv.mjs` | Importa questões via CSV; resolve área/grupo/tema/referência por nome; cria tema ausente; **pula enunciados duplicados** |
| `import-references.mjs` | Popula `reference` a partir de `reference/livros_referencia.csv` (idempotente) |
| `setup-user-passwords.mjs` | Cria contas no Auth para usuários legados e vincula `authUid` |
| `recalc-question-counts.mjs` | Recalcula `questionCount` de áreas e temas com consultas de agregação |
| `split-source-exam.mjs` | Deriva `sourceExamName` / `sourceExamYear` de `sourceExam` |
| `fix-question-area-id.mjs` | Corrige `areaId` gravado com o **nome** da área |
| `fix-question-theme-id.mjs` | Corrige `themeId` inválido e ressincroniza os campos derivados do tema |

Todos apontam explicitamente para o banco nomeado. Cada arquivo tem um cabeçalho detalhado com pré-requisitos e exemplos.

---

## Regras de Segurança

`firestore.rules` e `storage.rules` estão versionadas na raiz e referenciadas em `firebase.json`.

**Política:** qualquer leitura/escrita exige sessão do Firebase Auth (`request.auth != null`), com exceções deliberadas:

- **`users` é publicamente legível** — o login precisa achar o documento pelo e-mail *antes* de existir sessão, e o cadastro público precisa checar duplicidade. `create` sem sessão é permitido apenas quando `active == false && role == 'user'`.
- **`areas` e `themes`** são legíveis publicamente (taxonomia não sensível).
- **Caminhos de imagem no Storage** têm leitura pública, porque as imagens carregam por `<img src>` comum. A escrita exige sessão e valida tipo (`image/*`) e tamanho (10 MB para questões, 5 MB para avatares).

O bloco final nega tudo que não estiver listado — **criar uma coleção nova sem adicionar um `match` faz todas as operações falharem em produção**.

> ⚠️ **Duas ressalvas importantes.**
> 1. Estes arquivos foram escritos a partir do comportamento observado no código, **não** extraídos do console do Firebase. Compare com o publicado antes do primeiro `firebase deploy --only firestore:rules,storage:rules`.
> 2. **O CI não publica as regras** — o deploy automático é só do Hosting.

Duas limitações que as regras sozinhas não resolvem (detalhadas em [`architecture.md`](architecture.md#limitações-arquiteturais-conhecidas)):

1. **O gabarito é lido pelo navegador.** A correção roda no cliente, então qualquer sessão autenticada consegue ler `questionAnswers` de qualquer questão pelo SDK. Resolver exige mover a correção para uma Cloud Function.
2. **Não há isolamento por dono.** `attempts.userId` e afins guardam o ID interno do app, não `request.auth.uid` — as regras não têm como comparar.

---

## Deploy (CI/CD)

### `firebase.json`

```jsonc
{
  "hosting": {
    "site": "gen-lang-client-0316191622",
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [{
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
    }]
  },
  "firestore": { "database": "ai-studio-treinamentoteoti-...", "rules": "firestore.rules" },
  "storage":   { "rules": "storage.rules" }
}
```

- `public: "dist"` — o Hosting serve exatamente o que o `vite build` gera.
- O rewrite `** → /index.html` é o padrão SPA; arquivos estáticos reais têm prioridade.
- `no-cache` em `/index.html` garante que uma publicação nova não fique presa em cache enquanto os assets com hash mudam.
- As chaves `firestore`/`storage` só são usadas em deploy manual de regras.

### Workflow (`.github/workflows/deploy.yml`)

Dispara em `push` na **`main`** (e manualmente por `workflow_dispatch`):

1. Checkout
2. Node 24
3. Bun
4. `bun install`
5. `bun run build`
6. `FirebaseExtended/action-hosting-deploy@v0` → canal `live`, autenticando pelo secret **`FIREBASE_SERVICE_ACCOUNT`**

> A autenticação foi migrada de `FIREBASE_TOKEN` (descontinuado pelo Firebase, e cujo token expirou) para a action oficial com Service Account. O deploy cobre **apenas o Hosting**: o projeto não tem pasta `functions/`, e as regras de Firestore/Storage exigem deploy deliberado.

---

## Design system

Resumo — detalhamento completo em [`design.md`](design.md).

A interface segue uma paleta institucional clara. A decisão estrutural mais importante: em vez de recolorir centenas de classes, `src/index.css` **redefine os tokens do Tailwind v4** via `@theme`.

> ⚠️ **A escala `slate` está invertida.** `bg-slate-950` é o fundo **claro** da página, `bg-slate-900` é **branco** (card) e `text-slate-100` é o texto **navy escuro**. Trocar `text-slate-100` por `text-slate-900` deixa o texto branco sobre branco.

| Papel | Cor | Uso |
|---|---|---|
| Marca (residente) | `#1e8c7c` teal | Botões, atalhos, seleção |
| Acento administrativo | `#2f9c8c` cyan | Menu ativo, tabs, ações |
| Texto e *chrome* | `#2c3a47` navy | Texto primário e faixa de navegação |
| Verde de entrada | `#05413b` | Fundo das telas de login/cadastro e barra inferior mobile |
| Positivo / negativo / atenção | `#1e8c3f` / `#c7362f` / `#f05400` | Estados funcionais |

**Escala de desempenho** (regra única em `utils/helpers.ts`): `< 50%` vermelho `#E20018` · `50–59%` amarelo `#FFCB70` · `≥ 60%` verde `#079551`.

**Tipografia:** **Nunito Sans** (corpo) e **Poppins** (`h1`–`h3`), via Google Fonts.

**PWA:** manifest, ícones e meta tags — instalável, **sem service worker** (portanto sem offline).

---

## Pontos de atenção e dívidas técnicas

### Resolvidas (registradas para contexto)

1. ~~`npm start` quebrado~~ — o app nunca precisou de servidor Node em produção. O `server.ts` (Express + endpoint de IA) foi removido; `dev` roda o Vite direto e existe `preview` para conferir o build.
2. ~~Tipos do domínio duplicados~~ — `src/types/index.ts` era código morto e foi removido; `src/types.ts` é a fonte única.
3. ~~Regras de Segurança não versionadas~~ — `firestore.rules` e `storage.rules` estão no repositório (com as ressalvas acima).
4. ~~Geração de questões por IA~~ — removida por completo, junto com a dependência `@google/genai`, o Express e todo o cluster de UI que nunca esteve conectado a uma rota real.
5. ~~`VITE_FIREBASE_*` vestigiais~~ — hoje são overrides reais sobre `firebase-applet-config.json`.
6. ~~Deploy com `FIREBASE_TOKEN`~~ — migrado para a action oficial com Service Account.

### Ativas

| Item | Situação |
|---|---|
| **`vite.config.ts` precisa manter o plugin `tailwindcss()`** | Removê-lo produz um build "bem-sucedido" com CSS sem nenhuma utilitária — a app renderiza **sem estilo algum**. Já aconteceu uma vez. |
| **Gabarito lido pelo cliente** | Sem Cloud Function, qualquer sessão autenticada pode ler `questionAnswers` pelo SDK. |
| **Sem isolamento por dono nas Regras** | `authUid` é persistido, mas as regras ainda não o usam para restringir acesso. |
| **Índice de *collection group*** | `getExamsContainingQuestion()` pode exigir um índice criado manualmente no console (o erro traz o link). |
| **Leituras de coleção inteira** | Várias telas carregam todas as questões / tentativas / estatísticas. Adequado à escala atual, não a uma ordem de grandeza maior. |
| **`questionCount` não é mantido** | Gravado como `0` na importação e nunca atualizado; hoje não é lido por nenhuma tela. `recalc-question-counts.mjs` reconcilia. |
| **Campos descontinuados em provas antigas** | `shuffleAlternatives` e `showResultAfterFinish` foram removidos do código, mas continuam gravados em provas criadas antes disso. São ignorados na leitura — resíduo inofensivo, sem migração. |
| **Cronograma em código** | Os 19 eventos vivem em `src/constants.ts`; alterá-los exige editar e publicar. |
| **Coleção `groups` sem rotina de criação** | Precisa existir previamente no Firestore; nenhum script do repositório a popula. |
| **Duas identidades cromáticas** | As telas de entrada usam verde `#05413b` + âmbar; o produto usa teal SBOT + navy. Ver [`design.md`](design.md#divergências-conhecidas). |
| **Sem testes automatizados** | Não há suíte de testes; `tsc --noEmit` é a única verificação estática. |
| **Sem service worker** | O PWA é instalável, mas não funciona offline. |

---

*Desenvolvido por Mauriston Martins.*
