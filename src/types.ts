export type UserRole = 'user' | 'admin';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
  authUid?: string;
}

export interface Area {
  id: string;
  name: string;
  questionCount?: number;
}

export interface Theme {
  id: string;
  areaId: string;
  areaName?: string;
  name: string;
  questionCount?: number;
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
  sourceExam: string; // e.g. "TEOT 2023", "SBOT"
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
  updatedAt?: any;
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

