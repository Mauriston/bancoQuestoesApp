import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Attempt, AttemptAnswer, QuestionAnswer, UserStats, AreaStat, ThemeStat } from '../types';
import { getAttemptById, getAttemptAnswers, getQuestionAnswer } from './firebaseService';

export async function finishAndGradeAttempt(
  attemptId: string, 
  elapsedSeconds: number
): Promise<Attempt> {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Tentativa de prova não encontrada");

  // Prevent double grading
  if (attempt.status === 'completed') {
    return attempt;
  }

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
  const attemptRef = doc(db, 'attempts', attemptId);
  const updatedAttemptData = {
    status: 'completed' as const,
    correctAnswers: correctCount,
    wrongAnswers: wrongCount,
    unansweredQuestions: unansweredCount,
    scorePercentage,
    elapsedSeconds,
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

  // Update aggregated User Stats
  const userId = attempt.userId;
  const statsRef = doc(db, 'userStats', userId);
  const statsSnap = await getDoc(statsRef);

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

  await setDoc(statsRef, {
    userId,
    totalSolved: newTotalSolved,
    totalCorrect: newTotalCorrect,
    overallScorePercentage: newOverallPercentage,
    lastActiveDate: new Date().toISOString().split('T')[0],
    areas: newAreas,
    themes: newThemes,
    updatedAt: serverTimestamp()
  });

  return {
    ...attempt,
    status: 'completed',
    correctAnswers: correctCount,
    wrongAnswers: wrongCount,
    unansweredQuestions: unansweredCount,
    scorePercentage,
    elapsedSeconds
  };
}
