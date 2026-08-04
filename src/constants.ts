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
