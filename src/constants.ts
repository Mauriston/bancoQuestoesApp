// Opções fixas do filtro "Fonte da Questão" (campo `sourceExam` no
// Firestore) usado em QuestionsPage e CreateExamPage. Lista definida pelo
// admin — não é derivada dinamicamente do banco, então continua completa
// mesmo antes de existir alguma questão cadastrada com um determinado valor.
export const SOURCE_EXAM_OPTIONS: string[] = [
  'TEOT 2021',
  'TEOT 2022',
  'TEOT 2023',
  'TEOT 2024',
  'TEOT 2025',
  'TEOT 2026',
  'TARO 2016',
  'TARO 2017',
  'TARO 2018',
  'TARO 2019',
  'TARO 2020',
  'TARO 2021',
  'TARO 2022',
  'TARO 2023',
  'TARO 2024',
  'TARO 2025',
  'BANCO PRÓPRIO'
];

// Classifica o campo `sourceExam` de uma questão para colorir o chip de
// origem mostrado ao lado de "Questão X" (relatório do candidato, provas
// elaboradas pelo admin, banco de questões): vermelho para Banco Próprio,
// amarelo para TARO, verde para TEOT. Um valor livre que não bata com
// nenhum desses prefixos (ex.: registros antigos como "SBOT") cai no estilo
// neutro — sourceExam ainda é um campo de texto livre no cadastro/edição de
// questão, não restrito a SOURCE_EXAM_OPTIONS.
// Cronograma do Treinamento HMA TEOT 2027 (fixo, sem CRUD administrativo —
// ver imagem de referência fornecida pelo usuário). category define a cor do
// indicador na página de Cronograma do acesso User.
export interface TrainingScheduleItem {
  n: number;
  date: string; // dd/mm/yyyy
  title: string;
  subtitle: string;
  category: 'traumatologia' | 'ortopedia' | 'oncologia';
}

export const TRAINING_SCHEDULE: TrainingScheduleItem[] = [
  { n: 1, date: '13/07/2026', title: 'Pediátrica', subtitle: 'Trauma MMSS', category: 'traumatologia' },
  { n: 2, date: '20/07/2026', title: 'Pediátrica', subtitle: 'Trauma MMII', category: 'traumatologia' },
  { n: 3, date: '27/07/2026', title: 'Pediátrica', subtitle: 'Ortopedia 1', category: 'ortopedia' },
  { n: 4, date: '03/08/2026', title: 'Pediátrica', subtitle: 'Ortopedia 2', category: 'ortopedia' },
  { n: 5, date: '10/08/2026', title: 'Pediátrica', subtitle: 'Ortopedia 3', category: 'ortopedia' },
  { n: 6, date: '17/08/2026', title: 'Ombro e Cotovelo', subtitle: 'Traumatologia', category: 'traumatologia' },
  { n: 7, date: '24/08/2026', title: 'Ombro e Cotovelo', subtitle: 'Ortopedia', category: 'ortopedia' },
  { n: 8, date: '31/08/2026', title: 'Mão', subtitle: 'Traumatologia', category: 'traumatologia' },
  { n: 9, date: '07/09/2026', title: 'Mão', subtitle: 'Ortopedia', category: 'ortopedia' },
  { n: 10, date: '14/09/2026', title: 'Quadril', subtitle: 'Traumatologia', category: 'traumatologia' },
  { n: 11, date: '21/09/2026', title: 'Quadril', subtitle: 'Ortopedia', category: 'ortopedia' },
  { n: 12, date: '28/09/2026', title: 'Joelho', subtitle: 'Traumatologia', category: 'traumatologia' },
  { n: 13, date: '05/10/2026', title: 'Joelho', subtitle: 'Ortopedia', category: 'ortopedia' },
  { n: 14, date: '12/10/2026', title: 'Pé e Tornozelo', subtitle: 'Traumatologia', category: 'traumatologia' },
  { n: 15, date: '19/10/2026', title: 'Pé e Tornozelo', subtitle: 'Ortopedia', category: 'ortopedia' },
  { n: 16, date: '26/10/2026', title: 'Coluna', subtitle: 'Traumatologia', category: 'traumatologia' },
  { n: 17, date: '02/11/2026', title: 'Coluna', subtitle: 'Ortopedia', category: 'ortopedia' },
  { n: 18, date: '09/11/2026', title: 'Oncologia Ortopédica', subtitle: 'Tumores benignos e lesões pseudotumorais', category: 'oncologia' },
  { n: 19, date: '16/11/2026', title: 'Oncologia Ortopédica', subtitle: 'Tumores malignos', category: 'oncologia' },
];

export const TRAINING_SCHEDULE_NOTE = 'Teremos sabatinas nos feriados de 07/09, 12/10 e 02/11 (afinal não temos tempo a perder, safo?)';

export function getSourceExamChipClass(sourceExam: string): string {
  const normalized = (sourceExam || '').trim().toUpperCase();
  if (normalized.startsWith('TEOT')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (normalized.startsWith('TARO')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (normalized.startsWith('BANCO PRÓPRIO') || normalized.startsWith('BANCO PROPRIO')) {
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
}
