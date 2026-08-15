import {
   collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField,
   query, where, orderBy, limit, serverTimestamp, writeBatch, runTransaction, Timestamp, addDoc,
   documentId, Query, DocumentData, onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import {
   AppUser, Area, Group, Theme, Question, QuestionAnswer, Reference, Exam, ExamQuestion,
   ExamAssignment, Attempt, AttemptAnswer, UserStats, AdminLog, ImportLog,
   VideotecaItem, AulaItem, MaterialViewLog, Sabatina, SabatinaViewLog, AppNotification, NotificationAudience
 } from '../types';
import { normalizeText, generateId, shuffleArrayWithSeed } from '../utils/helpers';

// --- USERS ---

export async function ensureAdminUserExists(): Promise<void> {
  try {
    const adminEmail = "mauriston@oncoortopedia.com";
    const adminDocRef = doc(db, 'users', 'usr_mauriston_admin');
    const docSnap = await getDoc(adminDocRef);
    if (!docSnap.exists()) {
      await setDoc(adminDocRef, {
        id: 'usr_mauriston_admin',
        name: 'Mauriston',
        email: adminEmail,
        role: 'admin',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    console.warn("Aviso ao criar admin padrão no Firestore:", err);
  }
}

// Trigger bootstrap on module load
ensureAdminUserExists();

export async function getUsers(): Promise<AppUser[]> {
  await ensureAdminUserExists();
  const snapshot = await getDocs(collection(db, 'users'));
  const users: AppUser[] = [];
  snapshot.forEach(doc => {
    users.push({ id: doc.id, ...doc.data() } as AppUser);
  });
  return users.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActiveUsers(): Promise<AppUser[]> {
  await ensureAdminUserExists();
  const q = query(collection(db, 'users'), where('active', '==', true));
  const snapshot = await getDocs(q);
  const users: AppUser[] = [];
  snapshot.forEach(doc => {
    users.push({ id: doc.id, ...doc.data() } as AppUser);
  });
  return users.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as AppUser;
  }
  return null;
}

function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

export async function saveUser(userData: Omit<AppUser, 'id'> & { id?: string }): Promise<string> {
  const id = userData.id || generateId('usr');
  const userRef = doc(db, 'users', id);
  const rawPayload = {
    ...userData,
    id,
    updatedAt: serverTimestamp(),
    createdAt: userData.createdAt || serverTimestamp()
  };
  const payload = removeUndefined(rawPayload);
  await setDoc(userRef, payload, { merge: true });
  return id;
}

export async function updateUserActiveStatus(userId: string, active: boolean): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { active, updatedAt: serverTimestamp() });
}

export async function updateUserRole(userId: string, role: "user" | "admin"): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role, updatedAt: serverTimestamp() });
}

// phone vazio apaga o campo (deleteField()) em vez de gravar string vazia —
// mesmo padrão de referenceId em saveQuestion(), para permitir o admin
// desvincular um telefone já cadastrado.
export async function updateUserPhone(userId: string, phone: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const trimmed = phone.trim();
  await updateDoc(userRef, { phone: trimmed ? trimmed : deleteField(), updatedAt: serverTimestamp() });
}

// Apaga o documento do usuário. Não cascateia attempts/userStats/assignments
// para preservar o histórico agregado (dashboards, ranking) mesmo após a
// remoção do cadastro — diferente de deleteExam(), que precisa cascatear
// porque provas excluídas não devem deixar rastro de dados órfãos.
export async function deleteUserAccount(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId));
}

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, `user-avatars/${userId}/${fileName}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', userId), { photoUrl: url, updatedAt: serverTimestamp() });
  return url;
}

// --- AREAS & THEMES ---

export async function getAreas(): Promise<Area[]> {
  const snapshot = await getDocs(collection(db, 'areas'));
  const areas: Area[] = [];
  snapshot.forEach(doc => {
    areas.push({ id: doc.id, ...doc.data() } as Area);
  });
  return areas.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getThemes(areaId?: string): Promise<Theme[]> {
  let q = query(collection(db, 'themes'));
  if (areaId) {
    q = query(collection(db, 'themes'), where('areaId', '==', areaId));
  }
  const snapshot = await getDocs(q);
  const themes: Theme[] = [];
  snapshot.forEach(doc => {
    themes.push({ id: doc.id, ...doc.data() } as Theme);
  });
  return themes.sort((a, b) => a.name.localeCompare(b.name));
}

// --- GROUPS (agrupamento TEOT: Anatomia, Ciência Básica, Ortopedia Adulto,
// Ortopedia Infantil, Trauma Adulto, Trauma Infantil, Oncologia Ortopédica)
// ---
//
// Usado só para estatísticas de desempenho (dashboards e "Meu Desempenho") —
// nunca como filtro de questões no banco ou na elaboração de provas, papel
// que continua exclusivo da Área. Ver Group em types.ts.

export async function getGroups(): Promise<Group[]> {
  const snapshot = await getDocs(collection(db, 'groups'));
  const groups: Group[] = [];
  snapshot.forEach(doc => {
    groups.push({ id: doc.id, ...doc.data() } as Group);
  });
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

// --- REFERENCES (livros de referência bibliográfica dos gabaritos) ---

export async function getReferences(): Promise<Reference[]> {
  const snapshot = await getDocs(collection(db, 'reference'));
  const refs: Reference[] = [];
  snapshot.forEach(doc => {
    refs.push({ id: doc.id, ...doc.data() } as Reference);
  });
  return refs.sort((a, b) => a.referenceId.localeCompare(b.referenceId));
}

// --- QUESTIONS ---

export async function getQuestions(filters?: {
  areaId?: string;
  themeId?: string;
  // Lista de valores de `sourceExam` aceitos (filtro multi-seleção "Fonte da
  // Questão", opções fixas em SOURCE_EXAM_OPTIONS). Aplicado localmente, não
  // no servidor, porque pode ter mais de 1 item selecionado ao mesmo tempo.
  sourceExamIn?: string[];
  searchQuery?: string;
}): Promise<Question[]> {

  // Typed as Query<DocumentData> (not `any`) so doc.data() below keeps its
  // proper object type instead of widening to `unknown`, which previously
  // broke `tsc --noEmit` (the project's `npm run lint`) with "Spread types
  // may only be created from object types" and left the typecheck script
  // permanently red/unusable for catching real regressions.
  let q: Query<DocumentData> = collection(db, 'questions');

  // Filtros aplicados diretamente no banco de dados (lado do servidor) para performance
  if (filters?.areaId) {
    q = query(q, where('areaId', '==', filters.areaId));
  }
  if (filters?.themeId) {
    q = query(q, where('themeId', '==', filters.themeId));
  }

  const snapshot = await getDocs(q);
  let questions: Question[] = [];

  snapshot.forEach(doc => {
    questions.push({ id: doc.id, ...doc.data() } as Question);
  });

  // Filtros complexos (texto/fonte) feitos localmente na lista reduzida
  if (filters?.sourceExamIn && filters.sourceExamIn.length > 0) {
    const allowed = new Set(filters.sourceExamIn);
    questions = questions.filter(q => allowed.has(q.sourceExam));
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

export async function getQuestionById(questionId: string): Promise<Question | null> {
  const docRef = doc(db, 'questions', questionId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Question;
  }
  return null;
}

export async function getQuestionAnswer(questionId: string): Promise<QuestionAnswer | null> {
  const docRef = doc(db, 'questionAnswers', questionId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as QuestionAnswer;
  }
  return null;
}

// Busca em lote o gabarito de várias questões de uma vez (usado nas listagens
// do admin — Banco de Questões e seleção de questões na criação de provas —
// para mostrar a alternativa correta sem disparar uma leitura por questão).
// O operador `in` do Firestore aceita no máximo 30 valores por consulta, daí
// o particionamento em blocos.
export async function getQuestionAnswersByIds(questionIds: string[]): Promise<Record<string, QuestionAnswer>> {
  const result: Record<string, QuestionAnswer> = {};
  const uniqueIds = Array.from(new Set(questionIds));
  if (uniqueIds.length === 0) return result;

  const chunkSize = 30;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const q = query(collection(db, 'questionAnswers'), where(documentId(), 'in', chunk));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      result[docSnap.id] = docSnap.data() as QuestionAnswer;
    });
  }

  return result;
}

// Busca em lote várias questões originais do banco por id (mesmo particiona-
// mento em blocos de 30 do operador `in`). Usado para recuperar campos que
// não fazem parte da cópia congelada em `exams/{id}/questions`, como
// `sourceExam` — necessário para o chip de origem (Banco Próprio/TARO/TEOT)
// no relatório do candidato e na visualização de provas do admin.
export async function getQuestionsByIds(questionIds: string[]): Promise<Record<string, Question>> {
  const result: Record<string, Question> = {};
  const uniqueIds = Array.from(new Set(questionIds));
  if (uniqueIds.length === 0) return result;

  const chunkSize = 30;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const q = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      result[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as Question;
    });
  }

  return result;
}

// Lista as provas (nome + id) em que uma questão original já foi utilizada,
// pesquisando via collection group em todas as subcoleções
// `exams/{examId}/questions`, filtrando por `originalQuestionId`. Usado pelo
// QuestionPreviewModal para mostrar os chips "já usada em" no admin.
//
// ATENÇÃO: consultas collection group com `where` normalmente exigem um
// índice composto dedicado (escopo "collection group"), que o Firestore não
// cria automaticamente como faz com índices de coleção única. Se esta
// consulta falhar em produção com um erro do tipo "The query requires an
// index", o próprio erro traz um link para criar o índice necessário no
// console do Firebase — não é possível criar esse índice a partir deste
// ambiente (sem credenciais do projeto).
export async function getExamsContainingQuestion(originalQuestionId: string): Promise<{ examId: string; examName: string }[]> {
  const q = query(collectionGroup(db, 'questions'), where('originalQuestionId', '==', originalQuestionId));
  const snapshot = await getDocs(q);

  const examIds = Array.from(new Set(snapshot.docs.map(d => (d.data() as ExamQuestion).examId).filter(Boolean)));
  if (examIds.length === 0) return [];

  const exams = await Promise.all(examIds.map(examId => getExamById(examId)));
  return exams
    .filter((e): e is Exam => !!e)
    .map(e => ({ examId: e.id, examName: e.name }));
}

export async function saveQuestion(
  questionData: Omit<Question, 'id'> & { id?: string },
  answerData: { correctAlternative: "A" | "B" | "C" | "D"; solutionText?: string; comments: string; commentMediaUrl?: string; referenceId?: string }
): Promise<string> {
  const qId = questionData.id || generateId('q');

  // Public question document
  // removeUndefined() is required here: the Firestore SDK throws
  // "Unsupported field value: undefined" on setDoc/updateDoc, and optional
  // fields like imageUrl are routinely sent as `undefined` by the admin form.
  const qRef = doc(db, 'questions', qId);
  await setDoc(qRef, removeUndefined({
    ...questionData,
    id: qId,
    active: true,
    updatedAt: serverTimestamp(),
    createdAt: questionData.createdAt || serverTimestamp()
  }), { merge: true });

  // Protected answer key
  const ansRef = doc(db, 'questionAnswers', qId);
  // referenceId tratado à parte: removeUndefined() descartaria um valor
  // `undefined` sem tocar no campo já gravado no Firestore (merge:true), o
  // que impediria o admin de desvincular uma referência já escolhida antes
  // — por isso usa deleteField() nesse caso, mesmo padrão de
  // deleteQuestionImage() para imageUrl.
  const { referenceId, ...restAnswerData } = answerData;
  const ansPayload: Record<string, any> = removeUndefined({
    questionId: qId,
    ...restAnswerData,
    updatedAt: serverTimestamp()
  });
  ansPayload.referenceId = referenceId ? referenceId : deleteField();
  await setDoc(ansRef, ansPayload, { merge: true });

  return qId;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await deleteDoc(doc(db, 'questions', questionId));
  await deleteDoc(doc(db, 'questionAnswers', questionId));
}

export async function uploadQuestionImage(questionId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, `question-images/${questionId}/${fileName}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// Atalho usado pelo icon button "Adicionar imagem" da listagem: faz upload e
// já grava o imageUrl na questão, sem precisar abrir o modal completo de
// edição (que exige reenviar área/tema/enunciado etc via saveQuestion).
export async function addQuestionImage(questionId: string, file: File): Promise<string> {
  const url = await uploadQuestionImage(questionId, file);
  await updateDoc(doc(db, 'questions', questionId), { imageUrl: url, updatedAt: serverTimestamp() });
  return url;
}

// Remove a imagem de uma questão: apaga o objeto no Storage (a partir da
// própria download URL salva em imageUrl — funciona tanto para
// question-images/ quanto para imagens_questoes/, os dois caminhos usados
// hoje) e limpa o campo no Firestore. Falhas ao apagar o objeto (ex.: URL já
// não existe mais no bucket) não impedem limpar o campo do documento.
export async function deleteQuestionImage(questionId: string, imageUrl: string): Promise<void> {
  try {
    await deleteObject(ref(storage, imageUrl));
  } catch (err) {
    console.warn("Não foi possível apagar o objeto de imagem no Storage:", err);
  }
  await updateDoc(doc(db, 'questions', questionId), { imageUrl: deleteField(), updatedAt: serverTimestamp() });
}

// Envia uma imagem para imagens_questoes/{prova}/{arquivo} e vincula a URL
// pública resultante ao campo imageUrl de questions/{questionId} — usado
// pela importação em lote de imagens (BulkImagesPage), onde o id da questão
// já vem embutido no nome do arquivo (ex.: "<questionId>.jpeg"). Mesma
// convenção de caminho usada por scripts/import-question-images.mjs, só que
// pelo SDK cliente (sujeito às Regras de Segurança da sessão autenticada do
// admin, não ao Admin SDK).
export async function uploadBatchQuestionImage(
  prova: string,
  questionId: string,
  file: File
): Promise<string> {
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new Error(`Questão ${questionId} não encontrada no Firestore.`);
  }

  const storageRef = ref(storage, `imagens_questoes/${prova}/${file.name}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);

  await updateDoc(doc(db, 'questions', questionId), {
    imageUrl,
    updatedAt: serverTimestamp()
  });

  return imageUrl;
}

// --- EXAMS ---

export async function getExams(): Promise<Exam[]> {
  const snapshot = await getDocs(collection(db, 'exams'));
  const exams: Exam[] = [];
  snapshot.forEach(doc => {
    exams.push({ id: doc.id, ...doc.data() } as Exam);
  });
  return exams.sort((a, b) => {
    const aTime = a.createdAt ? (typeof a.createdAt === 'object' && 'seconds' in a.createdAt ? a.createdAt.seconds : 0) : 0;
    const bTime = b.createdAt ? (typeof b.createdAt === 'object' && 'seconds' in b.createdAt ? b.createdAt.seconds : 0) : 0;
    return bTime - aTime;
  });
}

export async function getExamById(examId: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, 'exams', examId));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Exam;
  }
  return null;
}

// Provas gravadas antes do campo `active` existir não têm esse campo no
// Firestore (`undefined`) — tratamos isso como ativo para não esconder
// provas que já estavam publicadas e em uso antes dessa funcionalidade.
// Só um `false` explícito (setado pelo admin) desativa.
export function isExamActive(exam: Exam | null | undefined): boolean {
  return !exam || exam.active !== false;
}

export async function updateExamActiveStatus(examId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'exams', examId), { active, updatedAt: serverTimestamp() });
}

export async function getExamQuestions(examId: string): Promise<ExamQuestion[]> {
  const snapshot = await getDocs(collection(db, 'exams', examId, 'questions'));
  const questions: ExamQuestion[] = [];
  snapshot.forEach(doc => {
    questions.push({ id: doc.id, ...doc.data() } as ExamQuestion);
  });
  return questions.sort((a, b) => (a.orderIndex || a.order || 0) - (b.orderIndex || b.order || 0));
}

// Ordem em que as questões são apresentadas durante a EXECUÇÃO de uma
// tentativa. Com `shuffleQuestions` ligado na prova, cada candidato recebe
// uma ordem própria, embaralhada de forma determinística a partir do
// attemptId — logo:
//   - candidatos diferentes veem ordens diferentes (attemptId é único);
//   - o mesmo candidato reencontra a MESMA ordem ao retomar a prova, o que é
//     essencial porque TakeExamPage retoma pela primeira questão sem resposta
//     dessa sequência; sem isso, o ponto de retomada saltaria a cada abertura.
// Com a opção desligada, todos respondem na ordem de elaboração.
//
// Vale SÓ para a execução: o relatório do candidato (ExamResultPage) e a
// visualização do admin (ExamViewPage) sempre usam a ordem de elaboração
// (`orderIndex`), que é a ordem canônica da prova.
export function orderQuestionsForAttempt(
  questions: ExamQuestion[],
  exam: Exam | null | undefined,
  attemptId: string
): ExamQuestion[] {
  if (!exam?.shuffleQuestions || !attemptId) return questions;
  return shuffleArrayWithSeed(questions, attemptId);
}

export async function createAndPublishExam(params: {
  examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>;
  questions: Question[];
  assignedUserIds: string[]; // "all" or specific list of user IDs
  adminId: string;
}): Promise<string> {
  const examId = generateId('ex');
  const examRef = doc(db, 'exams', examId);

  const newExam: Exam = {
    ...params.examData,
    id: examId,
    status: 'published',
    // Toda prova nasce inativa — só fica visível aos candidatos depois que
    // o admin a ativar explicitamente em ExamsListPage.
    active: false,
    questionCount: params.questions.length,
    createdBy: params.adminId,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
    publishedAt: serverTimestamp() as any
  };

  let batch = writeBatch(db);
  let opCount = 0;

  batch.set(examRef, newExam);
  opCount++;

  // Freeze public copy of selected questions into subcollection `exams/{examId}/questions`
  for (let i = 0; i < params.questions.length; i++) {
    const q = params.questions[i];
    const eqRef = doc(db, 'exams', examId, 'questions', `eq_${i + 1}`);
    // removeUndefined() avoids the Firestore "Unsupported field value: undefined"
    // error whenever a selected question has no imageUrl (the common case),
    // which previously made publishing an exam fail as soon as one question
    // in the selection had no image.
    const frozenQuestion: ExamQuestion = removeUndefined({
      id: `eq_${i + 1}`,
      examId,
      originalQuestionId: q.id,
      orderIndex: i + 1,
      order: i + 1,
      areaId: q.areaId,
      themeId: q.themeId,
      statement: q.statement,
      alternatives: q.alternatives,
      imageUrl: q.imageUrl || undefined
    });
    batch.set(eqRef, frozenQuestion);
    opCount++;

    // Controle de segurança para evitar erro de limite de 500 batches
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  // Create assignments
  let targetUserIds: string[] = [];
  if (params.assignedUserIds.includes('all')) {
    const activeUsers = await getActiveUsers();
    // O admin não realiza provas — mesmo que "all" seja escolhido, ele nunca
    // deve virar candidato de uma prova.
    targetUserIds = activeUsers.filter(u => u.role !== 'admin').map(u => u.id);
  } else {
    targetUserIds = params.assignedUserIds;
  }

  for (const userId of targetUserIds) {
    const assignId = generateId('asgn');
    const assignRef = doc(db, 'examAssignments', assignId);
    const assignment: ExamAssignment = {
      id: assignId,
      examId,
      userId,
      status: 'available',
      assignedAt: serverTimestamp() as any
    };
    batch.set(assignRef, assignment);
    opCount++;

    // Controle de segurança para atribuições massivas
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return examId;
}

// Edita uma prova já publicada: dados básicos + a seleção de questões
// (acrescentar/retirar). Só permitido enquanto a prova está inativa e sem
// nenhuma tentativa registrada — checado aqui como última linha de defesa
// (a UI já esconde a opção de editar fora desse cenário), para não haver
// como reescrever o conteúdo de uma prova que candidatos já começaram a
// responder.
export async function updateExamContent(params: {
  examId: string;
  examData: Pick<Exam,
    'name' | 'shuffleQuestions' | 'showCommentsAfterFinish' | 'allowReviewAfterFinish'
  >;
  questions: Question[];
}): Promise<void> {
  const { examId, examData, questions } = params;

  const [exam, existingAttempts, existingQuestionsSnap] = await Promise.all([
    getExamById(examId),
    getAttemptsForExam(examId),
    getDocs(collection(db, 'exams', examId, 'questions'))
  ]);

  if (!exam) throw new Error("Prova não encontrada.");
  if (isExamActive(exam)) {
    throw new Error("Só é possível editar provas inativas.");
  }
  if (existingAttempts.length > 0) {
    throw new Error("Esta prova já tem tentativas registradas e não pode mais ser editada.");
  }

  let batch = writeBatch(db);
  let opCount = 0;

  const queueSet = async (ref: ReturnType<typeof doc>, data: any, merge = false) => {
    batch.set(ref, data, { merge });
    opCount++;
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };
  const queueDelete = async (ref: ReturnType<typeof doc>) => {
    batch.delete(ref);
    opCount++;
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  // Remove todas as questões congeladas atuais para reconstruir do zero a
  // partir da nova seleção — mais simples e seguro que tentar reconciliar
  // qual questão foi adicionada, removida ou reordenada.
  for (const d of existingQuestionsSnap.docs) {
    await queueDelete(d.ref);
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const eqRef = doc(db, 'exams', examId, 'questions', `eq_${i + 1}`);
    const frozenQuestion: ExamQuestion = removeUndefined({
      id: `eq_${i + 1}`,
      examId,
      originalQuestionId: q.id,
      orderIndex: i + 1,
      order: i + 1,
      areaId: q.areaId,
      themeId: q.themeId,
      statement: q.statement,
      alternatives: q.alternatives,
      imageUrl: q.imageUrl || undefined
    });
    await queueSet(eqRef, frozenQuestion);
  }

  // merge:true — preserva campos não reenviados aqui (active, status,
  // createdBy, createdAt, publishedAt). Sem isso, o set() sobrescrevia o
  // documento inteiro e apagava o `active: false` da prova, fazendo-a
  // reaparecer como ativa para os candidatos assim que o admin salvava uma
  // edição.
  await queueSet(doc(db, 'exams', examId), removeUndefined({
    ...examData,
    questionCount: questions.length,
    updatedAt: serverTimestamp()
  }), true);

  if (opCount > 0) {
    await batch.commit();
  }
}

// Reverte o efeito de uma tentativa corrigida sobre o agregado userStats do
// residente (contraparte do somatório feito em finishAndGradeAttempt, em
// gradingService.ts). Usado tanto para excluir uma tentativa avulsa quanto
// na cascata de deleteExam() — sem isso, "Meu Desempenho" e os dashboards
// do admin ficariam inflados com dados de provas que não existem mais no
// histórico do usuário.
async function subtractFromUserStats(userId: string, answers: AttemptAnswer[]): Promise<void> {
  const areaBreakdown: Record<string, { total: number; correct: number }> = {};
  const themeBreakdown: Record<string, { total: number; correct: number }> = {};
  let correctCount = 0;
  let wrongCount = 0;

  for (const ans of answers) {
    if (!ans.selectedAlternative) continue; // não respondida nunca somou em userStats
    if (ans.isCorrect) correctCount++; else wrongCount++;
    if (ans.areaId) {
      if (!areaBreakdown[ans.areaId]) areaBreakdown[ans.areaId] = { total: 0, correct: 0 };
      areaBreakdown[ans.areaId].total += 1;
      if (ans.isCorrect) areaBreakdown[ans.areaId].correct += 1;
    }
    if (ans.themeId) {
      if (!themeBreakdown[ans.themeId]) themeBreakdown[ans.themeId] = { total: 0, correct: 0 };
      themeBreakdown[ans.themeId].total += 1;
      if (ans.isCorrect) themeBreakdown[ans.themeId].correct += 1;
    }
  }

  if (correctCount === 0 && wrongCount === 0) return;

  const statsRef = doc(db, 'userStats', userId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(statsRef);
    if (!snap.exists()) return;
    const current = snap.data() as UserStats;

    const newTotalSolved = Math.max(0, (current.totalSolved || 0) - (correctCount + wrongCount));
    const newTotalCorrect = Math.max(0, (current.totalCorrect || 0) - correctCount);
    const newOverallPercentage = newTotalSolved > 0 ? Math.round((newTotalCorrect / newTotalSolved) * 100) : 0;

    const newAreas = { ...(current.areas || {}) };
    Object.entries(areaBreakdown).forEach(([aId, data]) => {
      if (newAreas[aId]) {
        newAreas[aId] = {
          ...newAreas[aId],
          solved: Math.max(0, newAreas[aId].solved - data.total),
          correct: Math.max(0, newAreas[aId].correct - data.correct)
        };
      }
    });

    const newThemes = { ...(current.themes || {}) };
    Object.entries(themeBreakdown).forEach(([tId, data]) => {
      if (newThemes[tId]) {
        newThemes[tId] = {
          ...newThemes[tId],
          solved: Math.max(0, newThemes[tId].solved - data.total),
          correct: Math.max(0, newThemes[tId].correct - data.correct)
        };
      }
    });

    tx.set(statsRef, {
      ...current,
      totalSolved: newTotalSolved,
      totalCorrect: newTotalCorrect,
      overallScorePercentage: newOverallPercentage,
      areas: newAreas,
      themes: newThemes,
      updatedAt: serverTimestamp()
    });
  });
}

export async function deleteExam(examId: string): Promise<void> {
  // Deleting only the exam document leaves orphans behind, since Firestore
  // never cascade-deletes subcollections or docs in other collections that
  // merely reference the deleted id:
  //   1. the frozen `exams/{examId}/questions` subcollection (dead storage
  //      that getExamQuestions() would still happily serve if the id were
  //      ever reused);
  //   2. `examAssignments` docs still pointing residents at a prova that no
  //      longer exists, which breaks ExamsPage/TakeExamPage for them
  //      (getExamById returns null but the assignment stays 'available');
  //   3. `attempts` (and their `answers` subcollection) tied to this exam.
  //      Excluir a prova deve excluí-la também do histórico dos residentes
  //      — pedido explícito do admin — então essas tentativas saem junto,
  //      com a mesma reversão de userStats aplicada por deleteAttempt().
  //
  // The exam document itself is deleted first, on its own — that's the part
  // the admin actually asked for and it must not get stuck behind cleanup.
  // A single atomic batch spanning every resident's examAssignments doc used
  // to mean one denied/failed delete in that batch (any Firestore write
  // batch fails as a whole if one operation is rejected) silently took the
  // exam-document delete down with it, making "Excluir" look broken even
  // though the request itself was fine. Cleanup now runs after, best-effort.
  await deleteDoc(doc(db, 'exams', examId));

  try {
    const [questionsSnap, assignmentsSnap, attempts] = await Promise.all([
      getDocs(collection(db, 'exams', examId, 'questions')),
      getDocs(query(collection(db, 'examAssignments'), where('examId', '==', examId))),
      getAttemptsForExam(examId)
    ]);

    let batch = writeBatch(db);
    let opCount = 0;

    const queueDelete = async (ref: ReturnType<typeof doc>) => {
      batch.delete(ref);
      opCount++;
      if (opCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const d of questionsSnap.docs) await queueDelete(d.ref);
    for (const d of assignmentsSnap.docs) await queueDelete(d.ref);

    for (const attempt of attempts) {
      const answersSnap = await getDocs(collection(db, 'attempts', attempt.id, 'answers'));
      if (attempt.status === 'completed') {
        const answers = answersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttemptAnswer));
        await subtractFromUserStats(attempt.userId, answers);
      }
      for (const d of answersSnap.docs) await queueDelete(d.ref);
      await queueDelete(doc(db, 'attempts', attempt.id));
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (cleanupErr) {
    console.warn(`Prova ${examId} excluída, mas a limpeza de dados órfãos (questões congeladas/atribuições/tentativas) falhou:`, cleanupErr);
  }
}

// Exclui uma única tentativa do histórico de um usuário sem remover a prova
// em si. Se a tentativa já tinha sido corrigida, reverte o que ela somou em
// userStats; se estava ligada a uma examAssignment, essa atribuição volta
// para 'available' — senão o painel do residente ficaria com um card
// "Concluída"/link "Ver Relatório" apontando para uma tentativa inexistente.
export async function deleteAttempt(attemptId: string): Promise<void> {
  const attemptSnap = await getDoc(doc(db, 'attempts', attemptId));
  if (!attemptSnap.exists()) return;
  const attempt = { id: attemptId, ...attemptSnap.data() } as Attempt;

  const answersSnap = await getDocs(collection(db, 'attempts', attemptId, 'answers'));

  if (attempt.status === 'completed') {
    const answers = answersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttemptAnswer));
    await subtractFromUserStats(attempt.userId, answers);
  }

  let batch = writeBatch(db);
  let opCount = 0;
  for (const d of answersSnap.docs) {
    batch.delete(d.ref);
    opCount++;
    if (opCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  batch.delete(doc(db, 'attempts', attemptId));
  await batch.commit();

  if (attempt.assignmentId) {
    try {
      await updateDoc(doc(db, 'examAssignments', attempt.assignmentId), {
        status: 'available',
        startedAt: deleteField(),
        completedAt: deleteField(),
        attemptId: deleteField()
      });
    } catch (err) {
      console.warn(`Tentativa ${attemptId} excluída, mas não foi possível liberar a atribuição ${attempt.assignmentId} para nova tentativa:`, err);
    }
  }
}

// --- ASSIGNMENTS & ATTEMPTS ---

export async function getUserAssignments(userId: string): Promise<(ExamAssignment & { exam?: Exam })[]> {
  const q = query(collection(db, 'examAssignments'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const assignments: ExamAssignment[] = [];
  
  snapshot.forEach(doc => {
    assignments.push({ id: doc.id, ...doc.data() } as ExamAssignment);
  });

  // Attach exam details
  const result = await Promise.all(
    assignments.map(async (asgn) => {
      const exam = await getExamById(asgn.examId);
      return { ...asgn, exam: exam || undefined };
    })
  );

  return result;
}

// Atribuições de uma prova, uma por candidato, já com nome/telefone do
// usuário anexados — usado em ExamViewPage para montar a lista de "Enviar
// Convite" (link direto de WhatsApp para o assignmentId de cada um).
export async function getExamAssignmentsWithUsers(
  examId: string
): Promise<(ExamAssignment & { userName: string; userPhone?: string })[]> {
  const q = query(collection(db, 'examAssignments'), where('examId', '==', examId));
  const snapshot = await getDocs(q);
  const assignments: ExamAssignment[] = [];
  snapshot.forEach(doc => assignments.push({ id: doc.id, ...doc.data() } as ExamAssignment));

  const userIds = Array.from(new Set(assignments.map(a => a.userId)));
  const users = await Promise.all(userIds.map(id => getUserById(id)));
  const userById: Record<string, AppUser> = {};
  users.forEach(u => { if (u) userById[u.id] = u; });

  return assignments
    .map(a => ({
      ...a,
      userName: userById[a.userId]?.name || 'Usuário removido',
      userPhone: userById[a.userId]?.phone
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

// Todos os assignments de todas as provas — usado em ExamsListPage para
// contar convites enviados por prova (coluna "Convites") sem precisar de
// uma consulta por prova (mesmo padrão de getAllAttempts()).
export async function getAllExamAssignments(): Promise<ExamAssignment[]> {
  const snapshot = await getDocs(collection(db, 'examAssignments'));
  const assignments: ExamAssignment[] = [];
  snapshot.forEach(doc => assignments.push({ id: doc.id, ...doc.data() } as ExamAssignment));
  return assignments;
}

// Marca que o admin disparou o convite de WhatsApp para este assignment —
// não mexe em `status` de propósito (ver comentário em ExamAssignment).
export async function markAssignmentInvited(assignmentId: string): Promise<void> {
  await updateDoc(doc(db, 'examAssignments', assignmentId), { invitedAt: serverTimestamp() });
}

// Atribui a prova a candidatos adicionais depois de já elaborada/publicada
// (ver "Adicionar Candidatos" em ExamViewPage) — mesmo formato de assignment
// criado em createAndPublishExam, só que num batch avulso.
export async function addExamAssignments(examId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const batch = writeBatch(db);
  for (const userId of userIds) {
    const assignId = generateId('asgn');
    const assignment: ExamAssignment = {
      id: assignId,
      examId,
      userId,
      status: 'available',
      assignedAt: serverTimestamp() as any
    };
    batch.set(doc(db, 'examAssignments', assignId), assignment);
  }
  await batch.commit();
}

// Versão "ao vivo" de getUserAssignments() — usada em ExamsPage para que uma
// prova recém-atribuída (ou reativada) pelo admin apareça na hora, sem o
// residente precisar recarregar a página. Retorna a função de unsubscribe.
export function subscribeUserAssignments(
  userId: string,
  callback: (assignments: (ExamAssignment & { exam?: Exam })[]) => void
): () => void {
  const q = query(collection(db, 'examAssignments'), where('userId', '==', userId));
  return onSnapshot(q, async (snapshot) => {
    const assignments: ExamAssignment[] = [];
    snapshot.forEach(doc => assignments.push({ id: doc.id, ...doc.data() } as ExamAssignment));
    const result = await Promise.all(
      assignments.map(async (asgn) => {
        const exam = await getExamById(asgn.examId);
        return { ...asgn, exam: exam || undefined };
      })
    );
    callback(result);
  });
}

export async function startExamAttempt(assignmentId: string, userId: string, examId: string): Promise<{ attemptId: string; examQuestions: ExamQuestion[] }> {
  const exam = await getExamById(examId);
  if (!exam) throw new Error("Prova não encontrada");

  const [examQuestions, user] = await Promise.all([
    getExamQuestions(examId),
    getUserById(userId)
  ]);
  const assignmentRef = doc(db, 'examAssignments', assignmentId);

  // The previous implementation did a plain getDocs() lookup for an existing
  // 'in_progress' attempt and then a separate setDoc()/updateDoc(). Two
  // near-simultaneous calls (a second browser tab, a double click, a retried
  // request) could both see "no existing attempt" and each create their own
  // attempt doc, leaving the assignment pointing at only one of them while
  // the resident's answers end up split across two attempts. Claiming the
  // attempt id inside a transaction, keyed off the assignment document,
  // makes the "reuse or create" decision atomic.
  const attemptId = await runTransaction(db, async (tx) => {
    const assignSnap = await tx.get(assignmentRef);
    if (!assignSnap.exists()) throw new Error("Atribuição de prova não encontrada");
    const assignData = assignSnap.data() as ExamAssignment;

    if (assignData.attemptId) {
      const existingAttemptRef = doc(db, 'attempts', assignData.attemptId);
      const existingAttemptSnap = await tx.get(existingAttemptRef);
      if (existingAttemptSnap.exists()) {
        return assignData.attemptId;
      }
    }

    const newAttemptId = generateId('att');
    const attemptRef = doc(db, 'attempts', newAttemptId);
    const newAttempt: Attempt = removeUndefined({
      id: newAttemptId,
      examId,
      examName: exam.name,
      assignmentId,
      userId,
      userName: user?.name,
      status: 'in_progress',
      totalQuestions: examQuestions.length,
      startedAt: serverTimestamp() as any
    });

    tx.set(attemptRef, newAttempt);
    tx.update(assignmentRef, {
      status: 'started',
      startedAt: serverTimestamp(),
      attemptId: newAttemptId
    });

    return newAttemptId;
  });

  // A ordem só pode ser resolvida depois da transação, porque depende do
  // attemptId (ver orderQuestionsForAttempt) — inclusive quando a tentativa
  // é reaproveitada, e é justamente aí que a estabilidade importa.
  return { attemptId, examQuestions: orderQuestionsForAttempt(examQuestions, exam, attemptId) };
}

export async function saveAttemptAnswer(
  attemptId: string,
  examQuestionId: string,
  originalQuestionId: string,
  selectedAlternative: "A" | "B" | "C" | "D" | null,
  areaId: string,
  themeId: string
): Promise<void> {
  const answerRef = doc(db, 'attempts', attemptId, 'answers', examQuestionId);
  await setDoc(answerRef, {
    id: examQuestionId,
    attemptId,
    examQuestionId,
    originalQuestionId,
    selectedAlternative,
    areaId,
    themeId,
    answeredAt: serverTimestamp()
  }, { merge: true });
}

export async function getAttemptAnswers(attemptId: string): Promise<AttemptAnswer[]> {
  const snapshot = await getDocs(collection(db, 'attempts', attemptId, 'answers'));
  const answers: AttemptAnswer[] = [];
  snapshot.forEach(doc => {
    answers.push({ id: doc.id, ...doc.data() } as AttemptAnswer);
  });
  return answers;
}

export async function getAttemptById(attemptId: string): Promise<Attempt | null> {
  const snap = await getDoc(doc(db, 'attempts', attemptId));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Attempt;
  }
  return null;
}

export async function getUserAttempts(userId: string): Promise<Attempt[]> {
  const q = query(collection(db, 'attempts'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const attempts: Attempt[] = [];
  snapshot.forEach(doc => {
    attempts.push({ id: doc.id, ...doc.data() } as Attempt);
  });
  return attempts;
}

export async function getAllAttempts(): Promise<Attempt[]> {
  const snapshot = await getDocs(collection(db, 'attempts'));
  const attempts: Attempt[] = [];
  snapshot.forEach(doc => {
    attempts.push({ id: doc.id, ...doc.data() } as Attempt);
  });
  return attempts;
}

// Versão "ao vivo" de getAllAttempts() — usada no Dashboard admin para que
// os KPIs e a tabela de últimas tentativas atualizem sozinhos conforme os
// residentes concluem provas.
export function subscribeAllAttempts(callback: (attempts: Attempt[]) => void): () => void {
  return onSnapshot(collection(db, 'attempts'), (snapshot) => {
    const attempts: Attempt[] = [];
    snapshot.forEach(doc => attempts.push({ id: doc.id, ...doc.data() } as Attempt));
    callback(attempts);
  });
}

export async function getAttemptsForExam(examId: string): Promise<Attempt[]> {
  const q = query(collection(db, 'attempts'), where('examId', '==', examId));
  const snapshot = await getDocs(q);
  const attempts: Attempt[] = [];
  snapshot.forEach(doc => {
    attempts.push({ id: doc.id, ...doc.data() } as Attempt);
  });
  return attempts;
}

// Versão "ao vivo" de getAttemptsForExam() — usada em ExamViewPage para que
// a tabela "Respostas Enviadas" atualize sozinha assim que um residente
// termina a prova.
export function subscribeAttemptsForExam(examId: string, callback: (attempts: Attempt[]) => void): () => void {
  const q = query(collection(db, 'attempts'), where('examId', '==', examId));
  return onSnapshot(q, (snapshot) => {
    const attempts: Attempt[] = [];
    snapshot.forEach(doc => attempts.push({ id: doc.id, ...doc.data() } as Attempt));
    callback(attempts);
  });
}

// Per-question accuracy across every completed attempt of a given prova —
// used by the admin exam-review screen to show, alongside the gabarito, how
// many candidates got each question right.
export async function getExamQuestionStats(examId: string): Promise<Record<string, { totalAnswered: number; totalCorrect: number }>> {
  const attempts = (await getAttemptsForExam(examId)).filter(a => a.status === 'completed');

  const statsByExamQuestionId: Record<string, { totalAnswered: number; totalCorrect: number }> = {};

  const perAttemptAnswers = await Promise.all(attempts.map(a => getAttemptAnswers(a.id)));

  for (const answers of perAttemptAnswers) {
    for (const ans of answers) {
      if (!ans.selectedAlternative) continue; // não respondida, não entra na taxa de acerto
      if (!statsByExamQuestionId[ans.examQuestionId]) {
        statsByExamQuestionId[ans.examQuestionId] = { totalAnswered: 0, totalCorrect: 0 };
      }
      statsByExamQuestionId[ans.examQuestionId].totalAnswered += 1;
      if (ans.isCorrect) statsByExamQuestionId[ans.examQuestionId].totalCorrect += 1;
    }
  }

  return statsByExamQuestionId;
}

// --- USER STATS ---

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const snap = await getDoc(doc(db, 'userStats', userId));
  if (snap.exists()) {
    return snap.data() as UserStats;
  }
  return null;
}

// Estatísticas agregadas de todos os usuários — usado para calcular a média
// dos colegas por área/tema em PerformancePage (comparação de desempenho).
export async function getAllUserStats(): Promise<UserStats[]> {
  const snapshot = await getDocs(collection(db, 'userStats'));
  const stats: UserStats[] = [];
  snapshot.forEach(doc => stats.push(doc.data() as UserStats));
  return stats;
}

// Versão "ao vivo" de getAllUserStats() — mantém o ranking geral do
// Dashboard admin atualizado assim que uma prova é corrigida.
export function subscribeAllUserStats(callback: (stats: UserStats[]) => void): () => void {
  return onSnapshot(collection(db, 'userStats'), (snapshot) => {
    const stats: UserStats[] = [];
    snapshot.forEach(doc => stats.push(doc.data() as UserStats));
    callback(stats);
  });
}

export async function addAdminLog(adminId: string, adminName: string, action: string, details: string): Promise<void> {
  const logId = generateId('log');
  await setDoc(doc(db, 'adminLogs', logId), {
    id: logId,
    adminId,
    adminName,
    action,
    details,
    timestamp: serverTimestamp()
  });
}

// --- EXTRAS (Videoteca / Aulas) ---

// Normaliza documentos gravados antes da migração de `themeId` (único) para
// `themeIds`/`themeNames` (array) — sem isso, itens antigos quebram qualquer
// tela que assuma `themeIds` como array (ver ExtrasPage).
function normalizeThemeIds<T extends { themeIds?: string[] }>(raw: any): T {
  if (Array.isArray(raw.themeIds)) return raw as T;
  return {
    ...raw,
    themeIds: raw.themeId ? [raw.themeId] : [],
    themeNames: raw.themeName ? [raw.themeName] : []
  } as T;
}

export async function getVideotecaItems(): Promise<VideotecaItem[]> {
  const snapshot = await getDocs(collection(db, 'videotecaItems'));
  const items: VideotecaItem[] = [];
  snapshot.forEach(d => items.push(normalizeThemeIds<VideotecaItem>({ id: d.id, ...d.data() })));
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

// Versão "ao vivo" de getVideotecaItems() — um material inserido/editado/
// excluído pelo admin aparece na hora para quem estiver com a página Extras
// aberta, sem precisar recarregar.
export function subscribeVideotecaItems(callback: (items: VideotecaItem[]) => void): () => void {
  return onSnapshot(collection(db, 'videotecaItems'), (snapshot) => {
    const items: VideotecaItem[] = [];
    snapshot.forEach(d => items.push(normalizeThemeIds<VideotecaItem>({ id: d.id, ...d.data() })));
    callback(items.sort((a, b) => a.title.localeCompare(b.title)));
  });
}

export async function createVideotecaItem(data: Omit<VideotecaItem, 'id' | 'createdAt'>): Promise<string> {
  const id = generateId('vid');
  await setDoc(doc(db, 'videotecaItems', id), removeUndefined({ ...data, id, createdAt: serverTimestamp() }));
  return id;
}

export async function updateVideotecaItem(id: string, data: Omit<VideotecaItem, 'id' | 'createdAt'>): Promise<void> {
  await setDoc(doc(db, 'videotecaItems', id), removeUndefined({ ...data, id, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteVideotecaItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'videotecaItems', id));
}

export async function getAulaItems(): Promise<AulaItem[]> {
  const snapshot = await getDocs(collection(db, 'aulaItems'));
  const items: AulaItem[] = [];
  snapshot.forEach(d => items.push(normalizeThemeIds<AulaItem>({ id: d.id, ...d.data() })));
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

// Versão "ao vivo" de getAulaItems() — mesmo motivo de subscribeVideotecaItems.
export function subscribeAulaItems(callback: (items: AulaItem[]) => void): () => void {
  return onSnapshot(collection(db, 'aulaItems'), (snapshot) => {
    const items: AulaItem[] = [];
    snapshot.forEach(d => items.push(normalizeThemeIds<AulaItem>({ id: d.id, ...d.data() })));
    callback(items.sort((a, b) => a.title.localeCompare(b.title)));
  });
}

export async function createAulaItem(data: Omit<AulaItem, 'id' | 'createdAt'>): Promise<string> {
  const id = generateId('aula');
  await setDoc(doc(db, 'aulaItems', id), removeUndefined({ ...data, id, createdAt: serverTimestamp() }));
  return id;
}

export async function updateAulaItem(id: string, data: Omit<AulaItem, 'id' | 'createdAt'>): Promise<void> {
  await setDoc(doc(db, 'aulaItems', id), removeUndefined({ ...data, id, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteAulaItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'aulaItems', id));
}

// Registra que um usuário abriu um material — usado tanto para marcar
// "visto"/"não visto" para o próprio usuário quanto para o admin conferir
// quem e quando visualizou cada material (ver getAllMaterialViewLogs).
export async function logMaterialView(materialId: string, materialType: 'video' | 'aula', userId: string, userName: string): Promise<void> {
  const id = generateId('view');
  await setDoc(doc(db, 'materialViewLogs', id), {
    id,
    materialId,
    materialType,
    userId,
    userName,
    viewedAt: serverTimestamp()
  });
}

// Todos os registros de visualização — usado pela página Extras (admin)
// para exibir o total de visualizações de cada material direto no card,
// sem precisar de 1 consulta por material.
export async function getAllMaterialViewLogs(): Promise<MaterialViewLog[]> {
  const snapshot = await getDocs(collection(db, 'materialViewLogs'));
  const logs: MaterialViewLog[] = [];
  snapshot.forEach(d => logs.push({ id: d.id, ...d.data() } as MaterialViewLog));
  return logs;
}

// Versão "ao vivo" de getAllMaterialViewLogs() — o contador/tooltip de
// visualizações de cada material, no card do admin, atualiza sozinho assim
// que alguém abre o material.
export function subscribeAllMaterialViewLogs(callback: (logs: MaterialViewLog[]) => void): () => void {
  return onSnapshot(collection(db, 'materialViewLogs'), (snapshot) => {
    const logs: MaterialViewLog[] = [];
    snapshot.forEach(d => logs.push({ id: d.id, ...d.data() } as MaterialViewLog));
    callback(logs);
  });
}

// IDs de materiais já vistos pelo usuário (Videoteca + Aulas juntas — o
// materialId já é suficiente para identificar unicamente o item de qualquer
// um dos dois tipos, já que são gerados com prefixos diferentes: vid_/aula_).
export async function getViewedMaterialIds(userId: string): Promise<Set<string>> {
  const q = query(collection(db, 'materialViewLogs'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const ids = new Set<string>();
  snapshot.forEach(d => ids.add((d.data() as MaterialViewLog).materialId));
  return ids;
}

// Versão "ao vivo" de getViewedMaterialIds() — o badge "Visto" e o contador
// de materiais não vistos nas abas atualizam sozinhos.
export function subscribeViewedMaterialIds(userId: string, callback: (ids: Set<string>) => void): () => void {
  const q = query(collection(db, 'materialViewLogs'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const ids = new Set<string>();
    snapshot.forEach(d => ids.add((d.data() as MaterialViewLog).materialId));
    callback(ids);
  });
}

// --- SABATINAS ---

export async function getSabatinas(): Promise<Sabatina[]> {
  const snapshot = await getDocs(collection(db, 'sabatinas'));
  const items: Sabatina[] = [];
  snapshot.forEach(d => items.push(normalizeThemeIds<Sabatina>({ id: d.id, ...d.data() })));
  return items;
}

// Versão "ao vivo" de getSabatinas() — uma sabatina recém-cadastrada pelo
// admin aparece na hora para quem estiver com a página aberta.
export function subscribeSabatinas(callback: (items: Sabatina[]) => void): () => void {
  return onSnapshot(collection(db, 'sabatinas'), (snapshot) => {
    const items: Sabatina[] = [];
    snapshot.forEach(d => items.push(normalizeThemeIds<Sabatina>({ id: d.id, ...d.data() })));
    callback(items);
  });
}

export async function createSabatina(data: Omit<Sabatina, 'id' | 'createdAt'>): Promise<string> {
  const id = generateId('sab');
  await setDoc(doc(db, 'sabatinas', id), removeUndefined({ ...data, id, createdAt: serverTimestamp() }));
  return id;
}

export async function updateSabatina(id: string, data: Omit<Sabatina, 'id' | 'createdAt'>): Promise<void> {
  await setDoc(doc(db, 'sabatinas', id), removeUndefined({ ...data, id, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteSabatina(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sabatinas', id));
}

// Registra que um usuário abriu uma sabatina — usado pelo admin para
// conferir o total de visualizações de cada sabatina (ver
// subscribeAllSabatinaViewLogs), mesmo padrão de logMaterialView.
export async function logSabatinaView(sabatinaId: string, userId: string, userName: string): Promise<void> {
  const id = generateId('sabview');
  await setDoc(doc(db, 'sabatinaViewLogs', id), {
    id,
    sabatinaId,
    userId,
    userName,
    viewedAt: serverTimestamp()
  });
}

// Versão "ao vivo" de todos os registros de visualização de sabatinas — o
// contador no card do admin atualiza sozinho assim que alguém abre uma.
export function subscribeAllSabatinaViewLogs(callback: (logs: SabatinaViewLog[]) => void): () => void {
  return onSnapshot(collection(db, 'sabatinaViewLogs'), (snapshot) => {
    const logs: SabatinaViewLog[] = [];
    snapshot.forEach(d => logs.push({ id: d.id, ...d.data() } as SabatinaViewLog));
    callback(logs);
  });
}

// --- NOTIFICAÇÕES ---

export async function createNotification(data: {
  type: AppNotification['type'];
  message: string;
  audience: NotificationAudience;
  actorId: string;
  actorName: string;
}): Promise<void> {
  const id = generateId('notif');
  await setDoc(doc(db, 'notifications', id), { ...data, id, createdAt: serverTimestamp() });
}

// Lista ao vivo (limitada às mais recentes) — a filtragem por audiência
// (admin só vê 'all'; user vê 'all' + 'users_only') é feita no cliente para
// não depender de um índice composto (where('audience','in',...) +
// orderBy('createdAt')) que precisaria ser criado manualmente no console.
export function subscribeNotifications(callback: (items: AppNotification[]) => void): () => void {
  const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    const items: AppNotification[] = [];
    snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as AppNotification));
    callback(items);
  });
}

// Só as notificações criadas depois de `sinceDate` (o momento em que a
// sessão/aba foi aberta) — usado para os pop-ups em tempo real, sem
// disparar um pop-up para cada notificação antiga já existente.
export function subscribeNewNotifications(sinceDate: Date, callback: (item: AppNotification) => void): () => void {
  const q = query(collection(db, 'notifications'), where('createdAt', '>', sinceDate), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        callback({ id: change.doc.id, ...change.doc.data() } as AppNotification);
      }
    });
  });
}

// "Lido até" por usuário — usado para calcular o badge de não lidas sem
// precisar de 1 documento de leitura por notificação por usuário.
export async function getNotificationReadState(userId: string): Promise<Date | null> {
  const snap = await getDoc(doc(db, 'notificationReads', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.lastReadAt?.toDate ? data.lastReadAt.toDate() : null;
}

export function subscribeNotificationReadState(userId: string, callback: (lastReadAt: Date | null) => void): () => void {
  return onSnapshot(doc(db, 'notificationReads', userId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    const data = snap.data();
    callback(data.lastReadAt?.toDate ? data.lastReadAt.toDate() : null);
  });
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await setDoc(doc(db, 'notificationReads', userId), { userId, lastReadAt: serverTimestamp() }, { merge: true });
}
