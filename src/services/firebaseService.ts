export async function getQuestions(filters?: {
  areaId?: string;
  themeId?: string;
  sourceExam?: string;
  hasImage?: boolean;
  searchQuery?: string;
}): Promise<Question[]> {
  // 1. Iniciamos a referência base apontando para a coleção inteira
  let q: any = collection(db, 'questions');

  // 2. Aplicamos os filtros nativos do Firestore (Server-side)
  // Isso impede o download desnecessário de milhares de questões.
  if (filters?.areaId) {
    q = query(q, where('areaId', '==', filters.areaId));
  }
  if (filters?.themeId) {
    q = query(q, where('themeId', '==', filters.themeId));
  }
  if (filters?.sourceExam) {
    q = query(q, where('sourceExam', '==', filters.sourceExam));
  }

  // 3. Executamos a busca no banco apenas com os filtros aplicados
  const snapshot = await getDocs(q);
  let questions: Question[] = [];
  
  snapshot.forEach(doc => {
    questions.push({ id: doc.id, ...doc.data() } as Question);
  });

  // 4. Filtros complexos (como busca parcial de texto) são feitos no cliente (Client-side).
  // Como filtramos área e tema no servidor antes, essa lista agora é muito menor e leve!
  if (filters?.hasImage !== undefined) {
    questions = questions.filter(q => filters.hasImage ? !!q.imageUrl : !q.imageUrl);
  }
  if (filters?.searchQuery) {
    const qNorm = normalizeText(filters.searchQuery);
    questions = questions.filter(q => 
      normalizeText(q.statement).includes(qNorm) ||
      normalizeText(q.sourceExam || '').includes(qNorm) ||
      normalizeText(q.id).includes(qNorm)
    );
  }

  return questions;
}
