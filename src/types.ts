export type UserRole = 'user' | 'admin';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  // Foto de perfil (Firebase Storage, path user-avatars/{userId}/...). Sem
  // isso, o avatar mostra a inicial do nome (ver componente Avatar).
  photoUrl?: string;
  // Celular/WhatsApp do usuário, em qualquer formato digitado pelo admin
  // (ver formatPhoneForWhatsApp em utils/helpers.ts, que limpa e completa o
  // DDI na hora de montar o link de convite). Usado para o botão "Enviar
  // Convite" de cada prova em ExamViewPage.
  phone?: string;
  createdAt?: any;
  updatedAt?: any;
  authUid?: string;
}

export interface Area {
  id: string;
  name: string;
  questionCount?: number;
}

// Agrupamento oficial do TEOT (Anatomia, Ciência Básica, Ortopedia Adulto,
// Ortopedia Infantil, Trauma Adulto, Trauma Infantil, Oncologia Ortopédica),
// coleção própria `groups` no Firestore. Independente da hierarquia de Área
// (região anatômica/especialidade, ex.: Mão, Joelho, Quadril) — um mesmo
// Grupo reúne temas de várias Áreas diferentes (ex.: "Trauma Adulto" cruza
// Mão, Joelho, Ombro e Cotovelo etc.), por isso não é um nível acima/abaixo
// de Área, e sim um agrupamento paralelo, usado só para estatísticas de
// desempenho — nunca para filtrar questões no banco ou na elaboração de
// provas (isso continua sendo papel exclusivo da Área).
export interface Group {
  id: string;
  name: string;
  questionCount?: number;
  active?: boolean;
}

export interface Theme {
  id: string;
  areaId: string;
  areaName?: string;
  name: string;
  questionCount?: number;
  // Grupo TEOT do tema (ver Group acima) — denormalizado a partir de
  // `groups/{id}` para permitir montar estatísticas por grupo sem precisar
  // cruzar com essa coleção a cada leitura. Ver
  // reference/areas_grupos_temas.json para a árvore Área → Grupo → Temas.
  groupId?: string;
  groupName?: string;
}

export interface QuestionAlternatives {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface Question {
  id: string;
  areaId: string;
  areaName?: string;
  themeId: string;
  themeName?: string;
  // Denormalizado do tema (ver Theme.groupId/groupName) para análises futuras
  // sem precisar cruzar com a coleção `themes`. As telas de estatística hoje
  // resolvem o grupo por themeId → `themes` (mesmo padrão usado para
  // areaName), então este par pode ficar ausente sem quebrar nada.
  groupId?: string;
  groupName?: string;
  sourceExam: string; // e.g. "TEOT 2023", "SBOT"
  // Derivados de sourceExam (ver scripts/split-source-exam.mjs) para
  // facilitar estatísticas por prova de origem sem parsing de string.
  // sourceExam continua sendo o campo usado por filtros/chip/CSV — estes
  // são só aditivos, ausentes em questões que ainda não passaram pela
  // migração.
  sourceExamName?: string; // e.g. "TEOT", "TARO", "BANCO PRÓPRIO"
  sourceExamYear?: number | null; // e.g. 2023, ou null quando não há ano (ex.: "BANCO PRÓPRIO")
  statement: string;
  alternatives: QuestionAlternatives;
  imageUrl?: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  dificuldade?: string;
}

export interface QuestionAnswer {
  questionId: string; // Document ID matches questionId
  correctAlternative: "A" | "B" | "C" | "D";
  solutionText?: string;
  comments?: string;
  // URL de imagem ou vídeo do YouTube renderizado junto dos comentários do
  // gabarito (relatório do candidato, banco de questões, visualização de
  // provas do admin) — ver componente CommentMedia.
  commentMediaUrl?: string;
  // Livro de referência do gabarito/comentário (ver Reference e coleção
  // `reference`) — id do doc em `reference/{id}`. Ausente quando a questão
  // não tem referência vinculada. Renderizado como "Fonte: {referenceName}"
  // (hiperlink para referenceUrlDownload) logo após o comentário, separado
  // por uma linha em branco — ver componente ReferenceSource.
  referenceId?: string;
  updatedAt?: any;
}

// Livro/fonte bibliográfica citável no gabarito de uma questão (coleção
// `reference`, raiz do Firestore — ver scripts/import-references.mjs e
// reference/livros_referencia.csv). O menu suspenso de seleção no formulário
// de questão mostra só `referenceId` (o código curto, ex.: "NETTER'S");
// `referenceName` é a citação completa (ABNT), usada como texto do
// hiperlink "Fonte: ..." que aponta para `referenceUrlDownload`.
export interface Reference {
  id: string;
  referenceId: string;
  referenceName: string;
  referenceUrlDownload: string;
  active?: boolean;
}

export interface Exam {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  // Controla se a prova fica visível/disponível para os candidatos
  // iniciarem. Toda prova nasce inativa (false) — o admin precisa ativá-la
  // explicitamente. Provas antigas sem esse campo são tratadas como ativas
  // (ver isExamActive() em firebaseService.ts) para não sumir do painel de
  // quem já tinha provas publicadas antes dessa funcionalidade existir.
  active?: boolean;
  questionCount: number;
  shuffleQuestions?: boolean;
  shuffleAlternatives?: boolean;
  showResultAfterFinish?: boolean;
  showCommentsAfterFinish?: boolean;
  allowReviewAfterFinish?: boolean;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
  publishedAt?: any;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  originalQuestionId: string;
  areaId: string;
  themeId: string;
  statement: string;
  alternatives: QuestionAlternatives;
  imageUrl?: string;
  orderIndex: number;
  order?: number;
}

export interface ExamAssignment {
  id: string;
  examId: string;
  userId: string;
  status: 'available' | 'started' | 'completed';
  assignedAt?: any;
  // Marca quando o admin enviou o convite de WhatsApp para este assignment
  // (ver ExamViewPage/handleSendInvite) — separado de `status` de propósito:
  // status segue o ciclo de vida real da prova para o candidato (usado por
  // ExamsPage/HomePage/TakeExamPage para decidir o que mostrar/permitir), e
  // não deve mudar só porque um convite foi enviado. invitedAt é só uma
  // marcação administrativa, contabilizada na coluna "Convites" de
  // ExamsListPage e no rótulo "Convidado" da tabela de candidatos.
  invitedAt?: any;
  startedAt?: any;
  completedAt?: any;
  attemptId?: string;
  exam?: Exam;
}

export interface Attempt {
  id: string;
  examId: string;
  examName?: string;
  userId: string;
  userName?: string;
  assignmentId: string;
  // 'grading' is a short-lived transactional lock set by finishAndGradeAttempt()
  // to prevent a concurrent duplicate submit from double-counting userStats.
  status: 'in_progress' | 'grading' | 'completed';
  startedAt?: any;
  completedAt?: any;
  totalQuestions: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unansweredQuestions?: number;
  scorePercentage?: number;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  examQuestionId: string;
  originalQuestionId: string;
  selectedAlternative: "A" | "B" | "C" | "D" | null;
  areaId: string;
  themeId: string;
  isCorrect?: boolean;
  correctAlternative?: "A" | "B" | "C" | "D";
  answeredAt?: any;
}

export interface AreaStat {
  areaId: string;
  areaName?: string;
  solved: number;
  correct: number;
}

export interface ThemeStat {
  themeId: string;
  themeName?: string;
  solved: number;
  correct: number;
}

export interface UserStats {
  id?: string;
  userId?: string;
  totalSolved: number;
  totalCorrect: number;
  overallScorePercentage?: number;
  streakDays?: number;
  lastActiveDate?: string;
  areaStats?: Record<string, { solved: number; correct: number }>;
  topicStats?: Record<string, { solved: number; correct: number }>;
  areas?: Record<string, AreaStat>;
  themes?: Record<string, ThemeStat>;
  updatedAt?: any;
}

export interface AdminLog {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  targetId?: string;
  details?: any;
  timestamp?: any;
}

export interface ImportLog {
  id: string;
  importedBy: string;
  fileName?: string;
  importedCount: number;
  timestamp?: any;
  details?: any;
}

// --- EXTRAS (Videoteca / Aulas) ---

export interface VideotecaItem {
  id: string;
  title: string;
  areaId: string;
  areaName?: string;
  // Um material pode pertencer a mais de um tema da mesma área.
  themeIds: string[];
  themeNames?: string[];
  url: string; // link do YouTube, embedado na Videoteca
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface AulaItem {
  id: string;
  title: string;
  areaId: string;
  areaName?: string;
  // Um material pode pertencer a mais de um tema da mesma área.
  themeIds: string[];
  themeNames?: string[];
  url: string; // link de apresentação (Canva ou Google Slides, modo "present")
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MaterialViewLog {
  id: string;
  materialId: string;
  materialType: 'video' | 'aula';
  userId: string;
  userName?: string;
  viewedAt?: any;
}

// --- SABATINAS ---

export interface Sabatina {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD' — string simples para evitar bugs de fuso horário
  areaId: string;
  areaName?: string;
  // Uma sabatina pode cobrir mais de um tema da mesma área.
  themeIds: string[];
  themeNames?: string[];
  url: string; // apresentação do Google Slides, modo "present"
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SabatinaViewLog {
  id: string;
  sabatinaId: string;
  userId: string;
  userName?: string;
  viewedAt?: any;
}

// --- NOTIFICAÇÕES ---

export type NotificationType =
  | 'exam_started' | 'exam_completed'
  | 'exam_activated' | 'sabatina_created' | 'video_created' | 'aula_created';

// 'all' = todos (users + admin) — eventos gerados por ações de usuários,
// que os colegas e o admin acompanham em tempo real (ex.: provas feitas
// juntas ao mesmo tempo). 'users_only' = eventos de ações do admin,
// avisando só os residentes (o próprio admin já sabe o que fez).
export type NotificationAudience = 'all' | 'users_only';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  audience: NotificationAudience;
  actorId: string;
  actorName: string;
  createdAt?: any;
}

export interface QuestionBankJsonRaw {
  _metadados?: {
    sistema?: string;
    total_areas?: number;
    total_temas?: number;
    total_questoes?: number;
  };
  dados?: Array<{
    area?: string;
    Area?: string;
    temas?: Array<{
      tema?: string;
      Tema?: string;
      questoes?: Array<{
        id?: string;
        enunciado?: string;
        statement?: string;
        alternativas?: any;
        gabarito?: string;
        comentario?: string;
        imagem?: string;
        prova?: string;
      }>;
    }>;
  }>;
}

