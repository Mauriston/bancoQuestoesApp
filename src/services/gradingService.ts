import { doc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Attempt, UserStats } from '../types';
import { getAttemptAnswers, getQuestionAnswer, buildAttemptResultSnapshot, saveAttemptResultSnapshot } from './firebaseService';

export async function finishAndGradeAttempt(
  attemptId: string
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
  const claim = await runTransaction(db, async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists()) throw new Error("Tentativa de prova não encontrada");
    const data = { id: attemptId, ...snap.data() } as Attempt;
    if (data.status !== 'in_progress') {
      return { alreadyHandled: true, attempt: data };
    }
    tx.update(attemptRef, { status: 'grading' as Attempt['status'] });
    return { alreadyHandled: false, attempt: data };
  });

  if (claim.alreadyHandled) {
    return claim.attempt;
  }

  const attempt = claim.attempt;

  const userAnswers = await getAttemptAnswers(attemptId);
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const areaBreakdown: Record<string, { total: number; correct: number }> = {};
  const themeBreakdown: Record<string, { total: number; correct: number }> = {};

  // Compare each question answer with protected answer key
  for (const ans of userAnswers) {
    const questionAnswer = await getQuestionAnswer(ans.originalQuestionId);
    
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

    // Save individual answer correctness
    const ansRef = doc(db, 'attempts', attemptId, 'answers', ans.examQuestionId);
    await updateDoc(ansRef, {
      isCorrect,
      answeredAt: serverTimestamp()
    });

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

  const totalQuestions = attempt.totalQuestions || userAnswers.length || 1;
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  // Update attempt document
  const updatedAttemptData = {
    status: 'completed' as const,
    correctAnswers: correctCount,
    wrongAnswers: wrongCount,
    unansweredQuestions: unansweredCount,
    scorePercentage,
    completedAt: serverTimestamp()
  };

  await updateDoc(attemptRef, updatedAttemptData);

  // Update Assignment document status
  if (attempt.assignmentId) {
    await updateDoc(doc(db, 'examAssignments', attempt.assignmentId), {
      status: 'completed',
      completedAt: serverTimestamp()
    });
  }

  // Update aggregated User Stats. This read-modify-write is wrapped in a
  // transaction because a resident can legitimately finish two different
  // exam attempts within the same second (e.g. two tabs, or an assignment
  // batch that auto-submits together); without a transaction the second
  // write would read stale data and silently overwrite/lose the first
  // update instead of adding to it.
  const userId = attempt.userId;
  const statsRef = doc(db, 'userStats', userId);

  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);

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
