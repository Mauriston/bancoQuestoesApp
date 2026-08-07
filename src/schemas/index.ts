import { z } from 'zod';

export const userCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["user", "admin"]),
  active: z.boolean().default(true),
  password: z.string().optional().refine((val) => {
    // Required if role is admin
    return true;
  })
});

export const examCreateSchema = z.object({
  name: z.string().min(3, "Nome da prova deve ter no mínimo 3 caracteres"),
  durationMinutes: z.number().min(0).optional(),
  shuffleQuestions: z.boolean().default(false),
  shuffleAlternatives: z.boolean().default(false),
  showResultAfterFinish: z.boolean().default(true),
  showCommentsAfterFinish: z.boolean().default(true),
  allowReviewAfterFinish: z.boolean().default(true),
  assignedUserIds: z.array(z.string()).min(1, "Selecione pelo menos um usuário ou 'Todos'")
});

export const questionCreateSchema = z.object({
  areaId: z.string().min(1, "Selecione uma Área"),
  themeId: z.string().min(1, "Selecione um Tema"),
  sourceExam: z.string().min(1, "Informe a Prova de Origem"),
  statement: z.string().min(5, "O enunciado deve ter pelo menos 5 caracteres"),
  alternatives: z.object({
    A: z.string().min(1, "Alternativa A é obrigatória"),
    B: z.string().min(1, "Alternativa B é obrigatória"),
    C: z.string().min(1, "Alternativa C é obrigatória"),
    D: z.string().min(1, "Alternativa D é obrigatória")
  }),
  correctAlternative: z.enum(["A", "B", "C", "D"]),
  solutionText: z.string().default(""),
  comments: z.string().default(""),
  imageUrl: z.string().nullable().default(null)
});
