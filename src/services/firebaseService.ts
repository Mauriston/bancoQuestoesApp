import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, serverTimestamp, writeBatch, Timestamp, addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { 
  AppUser, Area, Theme, Question, QuestionAnswer, Exam, ExamQuestion, 
  ExamAssignment, Attempt, AttemptAnswer, UserStats, AdminLog, ImportLog 
} from '../types';
import { normalizeText, generateId } from '../utils/helpers';

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

// --- QUESTIONS ---
export async function getQuestions(filters?: {
  areaId?: string;
  themeId?: string;
  sourceExam?: string;
  hasImage?: boolean;
  searchQuery?: string;
}): Promise<Question[]> {
  const snapshot = await getDocs(collection(db, 'questions'));
  let questions: Question[] = [];
  
  snapshot.forEach(doc => {
    questions.push({ id: doc.id, ...doc.data() } as Question);
  });

  if (filters?.areaId) {
    questions = questions.filter(q => q.areaId === filters.areaId);
  }
  if (filters?.themeId) {
    questions = questions.filter(q => q.themeId === filters.themeId);
  }
  if (filters?.sourceExam) {
    questions = questions.filter(q => q.sourceExam === filters.sourceExam);
  }
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

export async function saveQuestion(
  questionData: Omit<Question, 'id'> & { id?: string },
  answerData: { correctAlternative: "A" | "B" | "C" | "D"; solutionText: string; comments: string }
): Promise<string> {
  const qId = questionData.id || generateId('q');
  
  // Public question document
  const qRef = doc(db, 'questions', qId);
  await setDoc(qRef, {
    ...questionData,
    id: qId,
    active: true,
    updatedAt: serverTimestamp(),
    createdAt: questionData.createdAt || serverTimestamp()
  }, { merge: true });

  // Protected answer key
  const ansRef = doc(db, 'questionAnswers', qId);
  await setDoc(ansRef, {
    questionId: qId,
    ...answerData,
    updatedAt: serverTimestamp()
  }, { merge: true });

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

export async function getExamQuestions(examId: string): Promise<ExamQuestion[]> {
  const snapshot = await getDocs(collection(db, 'exams', examId, 'questions'));
  const questions: ExamQuestion[] = [];
  snapshot.forEach(doc => {
    questions.push({ id: doc.id, ...doc.data() } as ExamQuestion);
  });
  return questions.sort((a, b) => (a.orderIndex || a.order || 0) - (b.orderIndex || b.order || 0));
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
    questionCount: params.questions.length,
    createdBy: params.adminId,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
    publishedAt: serverTimestamp() as any
  };

  await setDoc(examRef, newExam);

  // Freeze public copy of selected questions into subcollection `exams/{examId}/questions`
  const batch = writeBatch(db);
  params.questions.forEach((q, idx) => {
    const eqRef = doc(db, 'exams', examId, 'questions', `eq_${idx + 1}`);
    const frozenQuestion: ExamQuestion = {
      id: `eq_${idx + 1}`,
      examId,
      originalQuestionId: q.id,
      orderIndex: idx + 1,
      order: idx + 1,
      areaId: q.areaId,
      themeId: q.themeId,
      statement: q.statement,
      alternatives: q.alternatives,
      imageUrl: q.imageUrl || undefined
    };
    batch.set(eqRef, frozenQuestion);
  });

  await batch.commit();

  // Create assignments
  let targetUserIds: string[] = [];
  if (params.assignedUserIds.includes('all')) {
    const activeUsers = await getActiveUsers();
    targetUserIds = activeUsers.map(u => u.id);
  } else {
    targetUserIds = params.assignedUserIds;
  }

  const assignBatch = writeBatch(db);
  targetUserIds.forEach(userId => {
    const assignId = generateId('asgn');
    const assignRef = doc(db, 'examAssignments', assignId);
    const assignment: ExamAssignment = {
      id: assignId,
      examId,
      userId,
      status: 'available',
      assignedAt: serverTimestamp() as any
    };
    assignBatch.set(assignRef, assignment);
  });

  await assignBatch.commit();

  return examId;
}

export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, 'exams', examId));
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

export async function startExamAttempt(assignmentId: string, userId: string, examId: string): Promise<{ attemptId: string; examQuestions: ExamQuestion[] }> {
  const exam = await getExamById(examId);
  if (!exam) throw new Error("Prova não encontrada");

  const examQuestions = await getExamQuestions(examId);

  // Check if attempt already exists
  const qAttempt = query(
    collection(db, 'attempts'), 
    where('assignmentId', '==', assignmentId), 
    where('status', '==', 'in_progress')
  );
  const existingSnaps = await getDocs(qAttempt);
  if (!existingSnaps.empty) {
    const existing = existingSnaps.docs[0];
    return { attemptId: existing.id, examQuestions };
  }

  // Create new attempt
  const attemptId = generateId('att');
  const attemptRef = doc(db, 'attempts', attemptId);
  const newAttempt: Attempt = {
    id: attemptId,
    examId,
    examName: exam.name,
    assignmentId,
    userId,
    status: 'in_progress',
    totalQuestions: examQuestions.length,
    startedAt: serverTimestamp() as any
  };

  await setDoc(attemptRef, newAttempt);

  // Update assignment status to 'started'
  await updateDoc(doc(db, 'examAssignments', assignmentId), {
    status: 'started',
    startedAt: serverTimestamp(),
    attemptId
  });

  return { attemptId, examQuestions };
}

export async function saveAttemptAnswer(
  attemptId: string, 
  examQuestionId: string, 
  originalQuestionId: string,
  selectedAlternative: "A" | "B" | "C" | "D" | null,
  areaId: string,
  themeId: string,
  flaggedForReview?: boolean
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
    flaggedForReview: flaggedForReview || false,
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

// --- USER STATS ---
export async function getUserStats(userId: string): Promise<UserStats | null> {
  const snap = await getDoc(doc(db, 'userStats', userId));
  if (snap.exists()) {
    return snap.data() as UserStats;
  }
  return null;
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
