import { Timestamp } from 'firebase/firestore';

export type UserRole = "user" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  authUid?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Area {
  id: string;
  name: string;
  normalizedName: string;
  questionCount: number;
  active: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Theme {
  id: string;
  areaId: string;
  name: string;
  normalizedName: string;
  questionCount: number;
  active: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Alternatives {
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
  sourceExam: string;
  statement: string;
  alternatives: Alternatives;
  imageUrl: string | null;
  active: boolean;
  importedAt?: Timestamp | string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface QuestionAnswer {
  questionId: string;
  correctAlternative: "A" | "B" | "C" | "D";
  solutionText: string;
  comments: string;
  updatedAt?: Timestamp | string;
}

export type ExamStatus = "draft" | "published" | "archived";

export interface Exam {
  id: string;
  name: string;
  description?: string;
  status: ExamStatus;
  questionCount: number;
  durationMinutes?: number;
  shuffleQuestions: boolean;
  shuffleAlternatives: boolean;
  showResultAfterFinish: boolean;
  showCommentsAfterFinish: boolean;
  allowReviewAfterFinish: boolean;
  availableFrom?: Timestamp | string | null;
  availableUntil?: Timestamp | string | null;
  createdBy: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  publishedAt?: Timestamp | string | null;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  originalQuestionId: string;
  order: number;
  areaId: string;
  areaName?: string;
  themeId: string;
  themeName?: string;
  statement: string;
  alternatives: Alternatives;
  imageUrl: string | null;
}

export type AssignmentStatus = "available" | "started" | "completed" | "expired";

export interface ExamAssignment {
  id: string;
  examId: string;
  examName?: string;
  userId: string;
  userName?: string;
  status: AssignmentStatus;
  assignedAt?: Timestamp | string;
  startedAt?: Timestamp | string | null;
  completedAt?: Timestamp | string | null;
  attemptId?: string | null;
}

export type AttemptStatus = "in_progress" | "completed" | "abandoned";

export interface Attempt {
  id: string;
  examId: string;
  examName?: string;
  assignmentId: string;
  userId: string;
  userName?: string;
  status: AttemptStatus;
  totalQuestions: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unansweredQuestions?: number;
  scorePercentage?: number;
  startedAt: Timestamp | string;
  completedAt?: Timestamp | string | null;
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  examQuestionId: string;
  originalQuestionId: string;
  selectedAlternative: "A" | "B" | "C" | "D" | null;
  isCorrect?: boolean;
  answeredAt?: Timestamp | string | null;
  areaId: string;
  themeId: string;
  flaggedForReview?: boolean;
}

export interface AreaStat {
  solved: number;
  correct: number;
}

export interface ThemeStat {
  solved: number;
  correct: number;
}

export interface UserStats {
  userId: string;
  totalSolved: number;
  totalCorrect: number;
  overallScorePercentage: number;
  lastActiveDate: string;
  areas: Record<string, AreaStat>;
  themes: Record<string, ThemeStat>;
  updatedAt?: Timestamp | string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  timestamp: Timestamp | string;
}

export interface ImportLog {
  id: string;
  importedBy: string;
  importedAt: Timestamp | string;
  totalAreas: number;
  totalThemes: number;
  totalQuestions: number;
  createdQuestions: number;
  updatedQuestions: number;
  errors: string[];
  status: "success" | "partial" | "failed";
}

export interface QuestionJsonRaw {
  ID?: string;
  id?: string;
  Prova?: string;
  prova?: string;
  Enunciado?: string;
  enunciado?: string;
  Alternativas?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  Solucao?: {
    Gabarito: "A" | "B" | "C" | "D";
    Texto: string;
  };
  solucao?: {
    gabarito: "A" | "B" | "C" | "D";
    texto: string;
  };
  Comentários?: string;
  comentarios?: string;
  Imagem?: string | null;
  imagem?: string | null;
}

export interface ThemeJsonRaw {
  Tema?: string;
  tema?: string;
  name?: string;
  questoes?: QuestionJsonRaw[];
}

export interface AreaJsonRaw {
  Área?: string;
  area?: string;
  name?: string;
  temas?: (ThemeJsonRaw | string)[];
}

export interface QuestionBankJsonRaw {
  _metadados?: {
    sistema?: string;
    total_areas?: number;
    total_temas?: number;
    total_questoes?: number;
  };
  dados?: AreaJsonRaw[];
}
