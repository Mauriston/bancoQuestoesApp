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
import { onDocumentUpdated, onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import {
  buildExamReportData,
  buildExamAdminReportData,
  buildReportDocument,
  type ExamReportData,
} from './_shared/reportTemplate';
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
  Sabatina,
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

// Content-Disposition com fallback ASCII + extensão UTF-8 (RFC 6266) — nomes
// reais têm acentos (ex.: "Mário Ivo"), e um Content-Disposition não-ASCII
// sem essa extensão é inválido/ignorado por vários clientes HTTP.
function buildContentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, "'");
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

interface GeneratedReportPdf {
  url: string;
  fileName: string;
}

// Núcleo compartilhado por dois gatilhos:
//  - generateExamReportPdf (onCall) — quando o candidato clica "Baixar PDF";
//  - onAttemptCompleted (gatilho do Firestore, abaixo) — automaticamente
//    assim que a prova é corrigida, sem esperar o candidato pedir.
// Idempotente: se a tentativa já tem reportPdfUrl salvo, devolve a mesma
// URL sem rodar o Chromium de novo.
async function generateAndPersistReportPdf(attemptId: string): Promise<GeneratedReportPdf> {
  const attemptRef = db.collection('attempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) {
    throw new HttpsError('not-found', 'Tentativa não encontrada.');
  }

  const existing = attemptSnap.data() as Attempt;
  if (existing.reportPdfUrl && existing.reportPdfFileName) {
    return { url: existing.reportPdfUrl, fileName: existing.reportPdfFileName };
  }

  const reportData = await fetchExamReportData(attemptId);
  const html = buildReportDocument(reportData, REPORT_ICON_URL);
  const pdfBuffer = await renderPdf(html);

  const fileName = buildReportFileName(reportData);
  const filePath = `exam-reports/${attemptId}/relatorio.pdf`;
  const downloadToken = randomUUID();
  const file = bucket.file(filePath);
  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: {
      // Imutável: uma vez gerado, o PDF de uma tentativa nunca é
      // reescrito (ver short-circuit acima), então pode ficar em cache
      // por muito tempo sem risco de servir conteúdo desatualizado.
      cacheControl: 'private, max-age=31536000, immutable',
      contentDisposition: buildContentDisposition(fileName),
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        attemptId,
        examName: reportData.examName,
        userName: reportData.userName,
        completedAt: reportData.completedAt || '',
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
    `/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

  // Esta escrita em attempts/{attemptId} é o que faz o botão "Baixar PDF"
  // virar "Ver PDF" no frontend (ver ExamResultPage.tsx) — e também é o
  // que faz onAttemptCompleted (abaixo) não re-disparar a si mesmo: essa
  // função só age quando `status` muda para 'completed', e essa escrita
  // não mexe em `status`.
  await attemptRef.set(
    {
      reportPdfUrl: url,
      reportPdfFileName: fileName,
      reportPdfGeneratedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { url, fileName };
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

    return generateAndPersistReportPdf(attemptId);
  }
);

// Pré-gera o PDF assim que a prova é corrigida (finishAndGradeAttempt, em
// gradingService.ts, muda `status` para 'completed') — o candidato não
// precisa mais clicar em "Baixar PDF" pra o arquivo existir; o botão já
// abre direto o PDF salvo na primeira vez que ExamResultPage carrega. Roda
// em background, fora do fluxo de finalização da prova no navegador, então
// não atrasa a resposta que o candidato vê ao enviar a prova.
export const onAttemptCompleted = onDocumentUpdated(
  {
    document: 'attempts/{attemptId}',
    database: FIRESTORE_DATABASE_ID,
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async event => {
    const before = event.data?.before.data() as Attempt | undefined;
    const after = event.data?.after.data() as Attempt | undefined;
    if (!after || before?.status === 'completed' || after.status !== 'completed') return;

    const attemptId = event.params.attemptId;
    try {
      await generateAndPersistReportPdf(attemptId);
    } catch (err) {
      // Best-effort: se falhar, o candidato ainda consegue gerar o PDF na
      // hora clicando em "Baixar PDF" (generateExamReportPdf acima).
      console.error(`Erro ao pré-gerar o PDF da tentativa ${attemptId}:`, err);
    }
  }
);

// Limpa o PDF salvo no Storage quando a tentativa é excluída — seja
// diretamente (deleteAttempt, ex.: admin apaga o relatório de um usuário
// específico) ou em cascata (deleteExam, ao apagar a prova inteira, que
// exclui todas as tentativas ligadas a ela) — ver firebaseService.ts.
// Gatilho do Firestore em vez de lógica no cliente: cobre os dois casos
// (e qualquer forma futura de excluir uma tentativa) com um único lugar,
// sem depender do código que fez a exclusão lembrar de limpar o Storage.
export const onAttemptDeleted = onDocumentDeleted(
  {
    document: 'attempts/{attemptId}',
    database: FIRESTORE_DATABASE_ID,
    region: 'us-central1',
  },
  async event => {
    const attemptId = event.params.attemptId;
    try {
      await bucket.deleteFiles({ prefix: `exam-reports/${attemptId}/`, force: true });
    } catch (err) {
      console.error(`Erro ao limpar o PDF salvo da tentativa ${attemptId}:`, err);
    }
  }
);


// ---------------------------------------------------------------------------
// PDF da prova (versão preceptor/admin): só questões, gabaritos e comentários,
// sem respostas de nenhum usuário. Mesmo template do relatório do candidato,
// em modo 'preceptor' (ver buildExamAdminReportData em reportTemplate.ts).
// ---------------------------------------------------------------------------

async function assertAdmin(auth: { uid: string; token: { email?: string } } | undefined): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'É necessário estar autenticado.');
  }
  const byUid = await db.collection('users').where('authUid', '==', auth.uid).limit(5).get();
  let isAdmin = byUid.docs.some(d => d.data().role === 'admin' && d.data().active !== false);
  if (!isAdmin && auth.token.email) {
    const byEmail = await db
      .collection('users')
      .where('email', '==', auth.token.email.trim().toLowerCase())
      .limit(5)
      .get();
    isAdmin = byEmail.docs.some(d => d.data().role === 'admin' && d.data().active !== false);
  }
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem gerar o PDF da prova.');
  }
}

async function fetchExamAdminReportData(examId: string): Promise<ExamReportData> {
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    throw new HttpsError('not-found', 'Prova não encontrada.');
  }
  const exam = { id: examSnap.id, ...examSnap.data() } as Exam;

  const [examQuestionsSnap, themesSnap, referencesSnap] = await Promise.all([
    db.collection('exams').doc(examId).collection('questions').get(),
    db.collection('themes').get(),
    db.collection('reference').get(),
  ]);

  const questions = examQuestionsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as ExamQuestion))
    .sort((a, b) => (a.orderIndex || a.order || 0) - (b.orderIndex || b.order || 0));
  if (questions.length === 0) {
    throw new HttpsError('failed-precondition', 'A prova não possui questões.');
  }

  const themes = themesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Theme));
  const references = referencesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reference));

  const originalIds = questions.map(q => q.originalQuestionId);
  const originalQuestions = await getByIdsChunked<Question>('questions', originalIds);
  const sourceExamById: Record<string, string> = {};
  Object.values(originalQuestions).forEach(oq => {
    sourceExamById[oq.id] = oq.sourceExam;
  });
  const answerKeys = await getByIdsChunked<QuestionAnswer>('questionAnswers', originalIds);

  return buildExamAdminReportData({
    exam,
    questions,
    sourceExamById,
    answerKeys,
    references,
    themes: themes.map(t => ({ id: t.id, name: t.name, groupName: t.groupName })),
  });
}

interface GeneratedExamPdf {
  url: string;
  fileName: string;
}

// force=true regenera mesmo que já exista pdfUrl. Sem force é idempotente.
async function generateAndPersistExamPdf(
  examId: string,
  options: { lock: boolean; force?: boolean }
): Promise<GeneratedExamPdf> {
  const examRef = db.collection('exams').doc(examId);
  const examSnap = await examRef.get();
  if (!examSnap.exists) {
    throw new HttpsError('not-found', 'Prova não encontrada.');
  }
  const existing = examSnap.data() as Exam;

  if (!options.force && existing.pdfUrl && existing.pdfFileName) {
    if (options.lock && !existing.editLocked) {
      await examRef.set({ editLocked: true }, { merge: true });
    }
    return { url: existing.pdfUrl, fileName: existing.pdfFileName };
  }

  const reportData = await fetchExamAdminReportData(examId);
  const html = buildReportDocument(reportData, REPORT_ICON_URL);
  const pdfBuffer = await renderPdf(html);

  const fileName = `${sanitizeForFileName(reportData.examName)} - Preceptor.pdf`;
  const filePath = `exam-pdfs/${examId}/prova.pdf`;
  const downloadToken = randomUUID();
  await bucket.file(filePath).save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: {
      // Sem cache longo: o arquivo pode ser regenerado no mesmo caminho.
      cacheControl: 'private, max-age=0, no-cache',
      contentDisposition: buildContentDisposition(fileName),
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        examId,
        examName: reportData.examName,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
    `/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

  const update: Record<string, unknown> = {
    pdfUrl: url,
    pdfFileName: fileName,
    pdfGeneratedAt: FieldValue.serverTimestamp(),
  };
  if (options.lock) update.editLocked = true;
  await examRef.set(update, { merge: true });

  return { url, fileName };
}

// Chamada pelo botão de PDF da tabela de provas (admin). Gerar o PDF
// "congela" a prova: editLocked impede novas edições de conteúdo.
export const generateExamPdf = onCall(
  { region: 'us-central1', memory: '1GiB', timeoutSeconds: 300, cpu: 1 },
  async request => {
    await assertAdmin(request.auth as any);

    const examId = typeof request.data?.examId === 'string' ? request.data.examId.trim() : '';
    if (!examId) {
      throw new HttpsError('invalid-argument', 'examId é obrigatório.');
    }
    return generateAndPersistExamPdf(examId, { lock: true });
  }
);

// Ao ativar uma prova (active: false -> true), gera automaticamente o PDF
// da versão do admin e salva no Storage. Não trava a edição (a regra de
// edição continua sendo "inativa e sem tentativas").
export const onExamActivated = onDocumentUpdated(
  {
    document: 'exams/{examId}',
    database: FIRESTORE_DATABASE_ID,
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async event => {
    const before = event.data?.before.data() as Exam | undefined;
    const after = event.data?.after.data() as Exam | undefined;
    if (!after || after.active !== true || before?.active === true) return;
    if (after.pdfUrl) return;

    const examId = event.params.examId;
    try {
      await generateAndPersistExamPdf(examId, { lock: false });
    } catch (err) {
      console.error(`Erro ao gerar o PDF da prova ${examId}:`, err);
    }
  }
);

// Limpa o PDF da prova do Storage quando a prova é excluída.
export const onExamDeleted = onDocumentDeleted(
  {
    document: 'exams/{examId}',
    database: FIRESTORE_DATABASE_ID,
    region: 'us-central1',
  },
  async event => {
    const examId = event.params.examId;
    try {
      await bucket.deleteFiles({ prefix: `exam-pdfs/${examId}/`, force: true });
    } catch (err) {
      console.error(`Erro ao limpar o PDF da prova ${examId}:`, err);
    }
  }
);


// ---------------------------------------------------------------------------
// PDF das sabatinas: baixa a apresentação do Google Slides (export/pdf) no
// servidor e arquiva no Storage, para o app abrir o PDF salvo em vez de
// baixar do Drive a cada clique. Requer que a apresentação esteja
// compartilhada como "qualquer pessoa com o link" (mesmo requisito do
// download feito antes pelo navegador).
// ---------------------------------------------------------------------------

function extractSlidesId(url: string): string | null {
  const match = (url || '').match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function downloadSlidesPdf(url: string): Promise<Buffer> {
  const id = extractSlidesId(url);
  if (!id) throw new Error('URL do Google Slides inválida.');
  const res = await fetch(`https://docs.google.com/presentation/d/${id}/export/pdf`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`O Google respondeu ${res.status} (a apresentação está pública por link?).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new Error('A resposta do Google não é um PDF (apresentação privada?).');
  }
  return buffer;
}

// force=false: não refaz se o PDF já foi gerado a partir da mesma `url`.
async function archiveSabatinaPdf(sabatinaId: string, force: boolean): Promise<'generated' | 'skipped'> {
  const ref = db.collection('sabatinas').doc(sabatinaId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Sabatina não encontrada.');
  const item = { id: snap.id, ...snap.data() } as Sabatina;

  if (!force && item.pdfUrl && item.pdfSourceUrl === item.url) return 'skipped';

  const pdf = await downloadSlidesPdf(item.url);
  const fileName = `${sanitizeForFileName(item.title)}.pdf`;
  const filePath = `sabatina-pdfs/${sabatinaId}/apresentacao.pdf`;
  const downloadToken = randomUUID();
  await bucket.file(filePath).save(pdf, {
    contentType: 'application/pdf',
    metadata: {
      cacheControl: 'private, max-age=0, no-cache',
      contentDisposition: buildContentDisposition(fileName),
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        sabatinaId,
        title: item.title,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const pdfUrl =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
    `/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
  await ref.set(
    {
      pdfUrl,
      pdfFileName: fileName,
      pdfSourceUrl: item.url,
      pdfGeneratedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return 'generated';
}

interface ArchiveSabatinasResult {
  total: number;
  generated: number;
  skipped: number;
  failed: { id: string; title: string; error: string }[];
}

// Admin: arquiva o PDF de uma sabatina (sabatinaId) ou de todas (sem id).
// force=true refaz mesmo as já arquivadas.
export const archiveSabatinaPdfs = onCall(
  { region: 'us-central1', memory: '1GiB', timeoutSeconds: 540, cpu: 1 },
  async request => {
    await assertAdmin(request.auth as any);

    const sabatinaId = typeof request.data?.sabatinaId === 'string' ? request.data.sabatinaId.trim() : '';
    const force = request.data?.force === true;

    const docs = sabatinaId
      ? [await db.collection('sabatinas').doc(sabatinaId).get()]
      : (await db.collection('sabatinas').get()).docs;

    const result: ArchiveSabatinasResult = { total: 0, generated: 0, skipped: 0, failed: [] };
    for (const d of docs) {
      if (!d.exists) continue;
      result.total += 1;
      const title = (d.data() as Sabatina).title || d.id;
      try {
        const outcome = await archiveSabatinaPdf(d.id, force);
        if (outcome === 'generated') result.generated += 1; else result.skipped += 1;
      } catch (err: any) {
        result.failed.push({ id: d.id, title, error: err?.message || String(err) });
      }
    }
    return result;
  }
);

// Sabatina criada ou com apresentação trocada → arquiva o PDF automaticamente.
export const onSabatinaWritten = onDocumentWritten(
  {
    document: 'sabatinas/{sabatinaId}',
    database: FIRESTORE_DATABASE_ID,
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 120,
  },
  async event => {
    const sabatinaId = event.params.sabatinaId;
    const after = event.data?.after.data() as Sabatina | undefined;
    if (!after) {
      // Excluída: limpa o PDF arquivado.
      try {
        await bucket.deleteFiles({ prefix: `sabatina-pdfs/${sabatinaId}/`, force: true });
      } catch (err) {
        console.error(`Erro ao limpar o PDF da sabatina ${sabatinaId}:`, err);
      }
      return;
    }
    // Já arquivado a partir desta mesma URL (inclui a escrita que o próprio
    // arquivamento faz em pdfUrl) → nada a fazer, evita laço.
    if (after.pdfUrl && after.pdfSourceUrl === after.url) return;
    if (!extractSlidesId(after.url)) return;

    try {
      await archiveSabatinaPdf(sabatinaId, true);
    } catch (err) {
      // Best-effort: o admin pode rodar "Arquivar PDFs" depois.
      console.error(`Erro ao arquivar o PDF da sabatina ${sabatinaId}:`, err);
    }
  }
);
