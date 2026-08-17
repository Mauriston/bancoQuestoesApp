// Geração do "Relatório de Prova" em PDF no servidor.
//
// Por que isto existe: gerar o PDF no navegador (window.print(), ver
// src/utils/examReport.ts) depende do usuário configurar corretamente o
// diálogo de impressão (margens "Nenhuma", sem cabeçalhos/rodapés) e de
// todas as imagens/fontes já terem carregado no momento do clique — mesmo
// corrigindo essa corrida no cliente, o resultado ainda passa pelo motor de
// impressão do navegador do usuário, fora do nosso controle. Aqui, o mesmo
// template (src/reportTemplate.ts) é renderizado com Chromium headless,
// num ambiente 100% controlado: sem diálogo de impressão, sem depender do
// navegador/SO do usuário, com margens e timing sempre corretos.
//
// Autorização: exige apenas uma sessão autenticada do Firebase Auth
// (inclusive anônima, usada pelos candidatos — ver AuthContext/authService),
// sem checar se o autor da chamada é o dono da tentativa. Isso replica a
// mesma limitação já documentada em firestore.rules (sessões de candidato
// não têm o vínculo authUid → users/{id} persistido, então não há como
// validar posse de forma confiável hoje) — não é uma regressão de segurança
// nova, é o mesmo modelo de acesso já em vigor no resto do app.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import { buildExamReportData, buildReportDocument, type ExamReportData } from './_shared/reportTemplate';
import type {
  Attempt,
  Exam,
  ExamQuestion,
  AttemptAnswer,
  QuestionAnswer,
  Reference,
  Area,
  Theme,
  Question,
} from './_shared/types';

// Mesmos valores de firebase-applet-config.json (projeto único, não há
// staging separado hoje) — ver src/services/firebase.ts no frontend.
const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';
const STORAGE_BUCKET = 'gen-lang-client-0316191622.firebasestorage.app';
const APP_ORIGIN = 'https://gen-lang-client-0316191622.firebaseapp.com';
const REPORT_ICON_URL = `${APP_ORIGIN}/icons/icon-512.png`;

const app = initializeApp();
const db: Firestore = getFirestore(app, FIRESTORE_DATABASE_ID);
const bucket = getStorage(app).bucket(STORAGE_BUCKET);

// Mesmo particionamento em blocos de 30 usado no frontend (limite do
// operador `in` do Firestore) — ver getQuestionsByIds/getQuestionAnswersByIds
// em src/services/firebaseService.ts.
async function getByIdsChunked<T>(collectionName: string, ids: string[]): Promise<Record<string, T>> {
  const result: Record<string, T> = {};
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  const chunkSize = 30;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const snap = await db.collection(collectionName).where(FieldPath.documentId(), 'in', chunk).get();
    snap.forEach(doc => {
      result[doc.id] = { id: doc.id, ...doc.data() } as T;
    });
  }
  return result;
}

// Mesmo cálculo de desempenho por área/tema/grupo de ExamResultPage.tsx
// (useMemo areaBreakdown/themeBreakdown/groupBreakdown) — só considera
// questões efetivamente respondidas.
function computeBreakdowns(questions: ExamQuestion[], answers: Record<string, AttemptAnswer>, areas: Area[], themes: Theme[]) {
  const areaMap: Record<string, { total: number; correct: number }> = {};
  const themeMap: Record<string, { total: number; correct: number }> = {};

  questions.forEach(q => {
    const ans = answers[q.id];
    if (!ans || !ans.selectedAlternative) return;

    if (!areaMap[q.areaId]) areaMap[q.areaId] = { total: 0, correct: 0 };
    areaMap[q.areaId].total += 1;
    if (ans.isCorrect) areaMap[q.areaId].correct += 1;

    if (!themeMap[q.themeId]) themeMap[q.themeId] = { total: 0, correct: 0 };
    themeMap[q.themeId].total += 1;
    if (ans.isCorrect) themeMap[q.themeId].correct += 1;
  });

  const areaBreakdown = Object.entries(areaMap)
    .map(([areaId, a]) => ({
      name: areas.find(ar => ar.id === areaId)?.name || areaId,
      accuracy: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0,
      correct: a.correct,
      total: a.total,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const themeBreakdown = Object.entries(themeMap)
    .map(([themeId, t]) => {
      const theme = themes.find(th => th.id === themeId);
      return {
        name: theme?.name || themeId,
        groupName: theme?.groupName || '',
        accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
        correct: t.correct,
        total: t.total,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  const groupMap: Record<string, { total: number; correct: number }> = {};
  themeBreakdown.forEach(t => {
    if (!t.groupName) return;
    if (!groupMap[t.groupName]) groupMap[t.groupName] = { total: 0, correct: 0 };
    groupMap[t.groupName].total += t.total;
    groupMap[t.groupName].correct += t.correct;
  });
  const groupBreakdown = Object.entries(groupMap)
    .map(([groupName, g]) => ({
      groupName,
      accuracy: g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0,
      correct: g.correct,
      total: g.total,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return { areaBreakdown, themeBreakdown, groupBreakdown };
}

async function fetchExamReportData(attemptId: string): Promise<ExamReportData> {
  const attemptSnap = await db.collection('attempts').doc(attemptId).get();
  if (!attemptSnap.exists) {
    throw new HttpsError('not-found', 'Tentativa não encontrada.');
  }
  const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as Attempt;

  const examSnap = await db.collection('exams').doc(attempt.examId).get();
  const exam = examSnap.exists ? ({ id: examSnap.id, ...examSnap.data() } as Exam) : null;

  const [examQuestionsSnap, answersSnap, areasSnap, themesSnap] = await Promise.all([
    db.collection('exams').doc(attempt.examId).collection('questions').get(),
    db.collection('attempts').doc(attemptId).collection('answers').get(),
    db.collection('areas').get(),
    db.collection('themes').get(),
  ]);

  const questions = examQuestionsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as ExamQuestion))
    .sort((a, b) => (a.orderIndex || a.order || 0) - (b.orderIndex || b.order || 0));

  const answers: Record<string, AttemptAnswer> = {};
  answersSnap.forEach(d => {
    const answer = { id: d.id, ...d.data() } as AttemptAnswer;
    answers[answer.examQuestionId] = answer;
  });

  const areas = areasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Area));
  const themes = themesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Theme));

  const originalQuestions = await getByIdsChunked<Question>('questions', questions.map(q => q.originalQuestionId));
  const sourceExamById: Record<string, string> = {};
  Object.values(originalQuestions).forEach(oq => {
    sourceExamById[oq.id] = oq.sourceExam;
  });

  let answerKeys: Record<string, QuestionAnswer> = {};
  let references: Reference[] = [];
  if (!exam || exam.showCommentsAfterFinish !== false) {
    answerKeys = await getByIdsChunked<QuestionAnswer>('questionAnswers', questions.map(q => q.originalQuestionId));
    const referencesSnap = await db.collection('reference').get();
    references = referencesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reference));
  }

  const { areaBreakdown, themeBreakdown, groupBreakdown } = computeBreakdowns(questions, answers, areas, themes);

  return buildExamReportData({
    attempt,
    exam,
    questions,
    answers,
    answerKeys,
    sourceExamById,
    references,
    areaBreakdown,
    groupBreakdown,
    themeBreakdown,
  });
}

async function renderPdf(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120_000 });

    // O próprio template só libera o botão de imprimir depois que todas as
    // imagens e as fontes web terminam de carregar e as páginas são
    // reajustadas com as medidas finais (ver waitUntilReadyToPrint em
    // src/reportTemplate.ts) — reaproveitamos exatamente esse sinal aqui
    // em vez de duplicar a lógica de "está pronto pra imprimir?".
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('print-btn') as HTMLButtonElement | null;
        return !!btn && !btn.disabled;
      },
      { timeout: 120_000 }
    );

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// Remove caracteres problemáticos em nome de arquivo (Windows inclusive,
// já que o relatório pode ser aberto em qualquer SO) e colapsa espaços —
// mesmo critério de toSafeFileName em src/utils/fileShare.ts.
function sanitizeForFileName(value: string): string {
  return value.trim().replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ');
}

// DD-MM-AAAA_HHhMM no fuso de Brasília — evita ":" (inválido em nome de
// arquivo no Windows) e ainda assim fica legível a olho nu.
function formatTimestampForFileName(iso: string | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('day')}-${get('month')}-${get('year')}_${get('hour')}h${get('minute')}`;
}

function buildReportFileName(reportData: ExamReportData): string {
  const timestamp = formatTimestampForFileName(reportData.completedAt);
  return `${sanitizeForFileName(reportData.userName)} - ${sanitizeForFileName(reportData.examName)} - ${timestamp}.pdf`;
}

export const generateExamReportPdf = onCall(
  { region: 'us-central1', memory: '1GiB', timeoutSeconds: 300, cpu: 1 },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'É necessário estar autenticado para gerar o relatório.');
    }

    const attemptId = typeof request.data?.attemptId === 'string' ? request.data.attemptId.trim() : '';
    if (!attemptId) {
      throw new HttpsError('invalid-argument', 'attemptId é obrigatório.');
    }

    const reportData = await fetchExamReportData(attemptId);
    const html = buildReportDocument(reportData, REPORT_ICON_URL);
    const pdfBuffer = await renderPdf(html);

    const filePath = `exam-reports/${attemptId}/relatorio.pdf`;
    const downloadToken = randomUUID();
    const file = bucket.file(filePath);
    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        cacheControl: 'private, max-age=0, no-cache',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
      `/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

    return {
      url,
      fileName: buildReportFileName(reportData),
    };
  }
);
