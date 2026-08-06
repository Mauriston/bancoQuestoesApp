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
export function getSourceExamChipClass(sourceExam: string): string {
  const normalized = (sourceExam || '').trim().toUpperCase();
  if (normalized.startsWith('TEOT')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (normalized.startsWith('TARO')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (normalized.startsWith('BANCO PRÓPRIO') || normalized.startsWith('BANCO PROPRIO')) {
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
}
