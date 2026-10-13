import { doc, updateDoc, runTransaction, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Attempt, UserStats } from '../types';
import { getAttemptAnswers, getQuestionAnswersByIds, buildAttemptResultSnapshot, saveAttemptResultSnapshot } from './firebaseService';

// Tempo máximo em que um "lock" de correção (status 'grading') é considerado
// vivo. Passado esse prazo, a correção é tida como interrompida (rede caiu,
// app fechado/suspenso pelo sistema no meio do processo) e pode ser retomada.
const GRADING_LOCK_TTL_MS = 60_000;

export async function finishAndGradeAttempt(
  attemptId: string,
  options: { force?: boolean } = {}
): Promise<Attempt> {

  const attemptRef = doc(db, 'attempts', attemptId);

  // Atomically claim the grading step. The previous check ("read status,
  // then later write 'completed'") left a window where a double click, a
  // retried network request, or two open tabs finishing the same attempt
  // could both read status 'in_progress' before either write landed — both
  // would then re-run the full grading loop below and each add their own
  // copy of the results into userStats, silently inflating totalSolved/
  // totalCorrect for the resident. Flipping status to 'grading' inside a
  // transaction makes the second concurrent call bail out immediately.
  //
  // O lock tem validade (GRADING_LOCK_TTL_MS): antes, se a correção fosse
  // interrompida depois de marcar 'grading' (ex.: conexão móvel instável
  // durante as ~240 leituras/escritas sequenciais), a tentativa ficava
  // presa nesse status para sempre — nenhuma nova tentativa de finalizar
  // corrigia de fato, e o relatório mostrava 0% com a prova "em andamento".
  // `force` (usado pelo admin em Resultados) retoma mesmo com lock recente.
  const claim = await runTransaction(db, async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists()) throw new Error("Tentativa de prova não encontrada");
    const data = { id: attemptId, ...snap.data() } as Attempt & { gradingStartedAt?: number };
    if (data.status === 'completed') {
      return { alreadyHandled: true, attempt: data as Attempt };
    }
    const lockAlive =
      data.status === 'grading' &&
      typeof data.gradingStartedAt === 'number' &&
      Date.now() - data.gradingStartedAt < GRADING_LOCK_TTL_MS;
    if (lockAlive && !options.force) {
      return { alreadyHandled: true, attempt: data as Attempt };
    }
    tx.update(attemptRef, { status: 'grading' as Attempt['status'], gradingStartedAt: Date.now() });
    return { alreadyHandled: false, attempt: data as Attempt };
  });

  if (claim.alreadyHandled) {
    return claim.attempt;
  }

  const attempt = claim.attempt;

  try {
    return await gradeClaimedAttempt(attemptId, attempt);
  } catch (err) {
    // Devolve a tentativa a 'in_progress' para que uma nova tentativa de
    // finalizar (do candidato ou do admin) não dependa de esperar o lock
    // expirar. Melhor esforço: se nem isso funcionar, o lock expira sozinho.
    try {
      await updateDoc(attemptRef, { status: 'in_progress', gradingStartedAt: deleteField() });
    } catch {
      // ignora
    }
    throw err;
  }
}

async function gradeClaimedAttempt(attemptId: string, attempt: Attempt): Promise<Attempt> {
  const attemptRef = doc(db, 'attempts', attemptId);

  const userAnswers = await getAttemptAnswers(attemptId);
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const areaBreakdown: Record<string, { total: number; correct: number }> = {};
  const themeBreakdown: Record<string, { total: number; correct: number }> = {};

  // Gabaritos de todas as questões numa só rodada (em lotes), em vez de uma
  // leitura sequencial por resposta.
  const answerKeys = await getQuestionAnswersByIds(userAnswers.map(a => a.originalQuestionId));

  const correctnessByAnswerId: Record<string, boolean> = {};

  // Compare each question answer with protected answer key
  for (const ans of userAnswers) {
    const questionAnswer = answerKeys[ans.originalQuestionId];

    let isCorrect = false;

    if (ans.selectedAlternative && questionAnswer) {
      if (ans.selectedAlternative === questionAnswer.correctAlternative) {
        isCorrect = true;
        correctCount++;
      } else {
        wrongCount++;
      }
    } else {
      unansweredCount++;
    }

    correctnessByAnswerId[ans.examQuestionId] = isCorrect;

    // Per-area & Per-theme tracking
    if (ans.areaId) {
      if (!areaBreakdown[ans.areaId]) areaBreakdown[ans.areaId] = { total: 0, correct: 0 };
      areaBreakdown[ans.areaId].total += 1;
      if (isCorrect) areaBreakdown[ans.areaId].correct += 1;
    }
    if (ans.themeId) {
      if (!themeBreakdown[ans.themeId]) themeBreakdown[ans.themeId] = { total: 0, correct: 0 };
      themeBreakdown[ans.themeId].total += 1;
      if (isCorrect) themeBreakdown[ans.themeId].correct += 1;
    }
  }

  // Save individual answer correctness (em lotes; idempotente — pode ser
  // refeito sem efeito colateral se a correção for retomada).
  const entries = Object.entries(correctnessByAnswerId);
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([examQuestionId, isCorrect]) => {
      batch.update(doc(db, 'attempts', attemptId, 'answers', examQuestionId), {
        isCorrect,
        answeredAt: serverTimestamp()
      });
    });
    await batch.commit();
  }

  const totalQuestions = attempt.totalQuestions || userAnswers.length || 1;
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  // Conclusão da tentativa + atualização do agregado userStats + status do
  // assignment numa ÚNICA transação: ou tudo é gravado, ou nada — assim uma
  // interrupção não deixa a tentativa 'completed' sem entrar nas
  // estatísticas, e retomar a correção nunca soma duas vezes (se a tentativa
  // já estiver 'completed' dentro da transação, ela é ignorada). A leitura-
  // -modificação-escrita do userStats continua protegida contra duas
  // finalizações simultâneas do mesmo residente.
  const userId = attempt.userId;
  const statsRef = doc(db, 'userStats', userId);

  await runTransaction(db, async (tx) => {
    const [attemptSnap, statsSnap] = await Promise.all([tx.get(attemptRef), tx.get(statsRef)]);
    if (attemptSnap.exists() && (attemptSnap.data() as Attempt).status === 'completed') {
      return;
    }

    let currentStats: UserStats = {
      userId,
      totalSolved: 0,
      totalCorrect: 0,
      overallScorePercentage: 0,
      lastActiveDate: new Date().toISOString().split('T')[0],
      areas: {},
      themes: {}
    };

    if (statsSnap.exists()) {
      currentStats = statsSnap.data() as UserStats;
    }

    const newTotalSolved = (currentStats.totalSolved || 0) + (correctCount + wrongCount);
    const newTotalCorrect = (currentStats.totalCorrect || 0) + correctCount;
    const newOverallPercentage = newTotalSolved > 0 ? Math.round((newTotalCorrect / newTotalSolved) * 100) : 0;

    const newAreas = { ...(currentStats.areas || {}) };
    Object.entries(areaBreakdown).forEach(([aId, data]) => {
      if (!newAreas[aId]) newAreas[aId] = { areaId: aId, solved: 0, correct: 0 };
      newAreas[aId].solved += data.total;
      newAreas[aId].correct += data.correct;
    });

    const newThemes = { ...(currentStats.themes || {}) };
    Object.entries(themeBreakdown).forEach(([tId, data]) => {
      if (!newThemes[tId]) newThemes[tId] = { themeId: tId, solved: 0, correct: 0 };
      newThemes[tId].solved += data.total;
      newThemes[tId].correct += data.correct;
    });

    tx.update(attemptRef, {
      status: 'completed',
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      unansweredQuestions: unansweredCount,
      scorePercentage,
      completedAt: serverTimestamp(),
      gradingStartedAt: deleteField()
    });

    if (attempt.assignmentId) {
      tx.set(doc(db, 'examAssignments', attempt.assignmentId), {
        status: 'completed',
        completedAt: serverTimestamp()
      }, { merge: true });
    }

    tx.set(statsRef, {
      userId,
      totalSolved: newTotalSolved,
      totalCorrect: newTotalCorrect,
      overallScorePercentage: newOverallPercentage,
      lastActiveDate: new Date().toISOString().split('T')[0],
      areas: newAreas,
      themes: newThemes,
      updatedAt: serverTimestamp()
    });
  });

  const finishedAttempt: Attempt = {
    ...attempt,
    status: 'completed',
    correctAnswers: correctCount,
    wrongAnswers: wrongCount,
    unansweredQuestions: unansweredCount,
    scorePercentage
  };

  // Pré-monta e salva tudo que ExamResultPage precisa pra exibir o
  // relatório desta tentativa — assim abrir a página (seja logo em
  // seguida, seja mais tarde a partir do Histórico) não refaz a leitura
  // completa (exame, questões, respostas, gabaritos, referências) toda
  // vez, só o Attempt em si. Roda aqui, dentro do "finalizando prova" que
  // TakeExamPage já mostra, em vez de deixar pra primeira visita à página
  // de resultado. Falha aqui não deve impedir a prova de ser finalizada —
  // na pior hipótese, a próxima visita ao relatório cai na busca completa
  // de sempre e grava o snapshot então, como cache lento.
  try {
    const snapshot = await buildAttemptResultSnapshot(finishedAttempt);
    await saveAttemptResultSnapshot(attemptId, snapshot);
  } catch (err) {
    console.error('Erro ao pré-montar o relatório da tentativa:', err);
  }

  return finishedAttempt;
}
