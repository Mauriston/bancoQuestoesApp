#!/usr/bin/env node
// ==========================================
// scripts/import-questions-csv.mjs
// ==========================================
//
// Importa questões em lote a partir de um CSV com colunas fixas:
//   sourceExam, sourceExamYear, areaName, groupName, themeName, statement,
//   A, B, C, D, correctAlternative, referenceName, comments
//
// Cria um doc em `questions/{id}` (id = UUID novo, gerado agora — o mesmo
// padrão dos IDs já usados no banco) + o gabarito correspondente em
// `questionAnswers/{id}`, para cada linha.
//
// RESOLUÇÃO DE ÁREA/TEMA/GRUPO/REFERÊNCIA (por nome, não por ID — o CSV só
// tem nomes legíveis)
//   - areaId: casado por `areas.name` (normalizado). Obrigatório — linha
//     sem área correspondente é pulada e reportada.
//   - groupId: casado por `groups.name` (normalizado). Obrigatório pelo
//     mesmo motivo.
//   - themeId: casado por `themes.name` (normalizado) DENTRO da área já
//     resolvida (mesmo tema pode existir em teoria com nome parecido em
//     outra área — por segurança só casa dentro da área certa). Se não
//     existir, o tema é CRIADO agora (mesmo padrão de
//     importQuestionBankJson, mas já com groupId preenchido de cara, o que
//     o importador antigo não fazia).
//   - referenceId: casado por `reference.referenceName` (normalizado).
//     Opcional — linha com referenceName vazio simplesmente não tem
//     referência; referenceName preenchido mas sem match vira aviso (a
//     questão é criada do mesmo jeito, só sem o vínculo).
//
// PROTEÇÃO CONTRA IMPORTAÇÃO DUPLICADA
//   Como os IDs de questão são aleatórios (não determinísticos a partir do
//   conteúdo, ao contrário de áreas/temas), rodar este script duas vezes
//   com o mesmo CSV criaria questões duplicadas. Por isso, antes de gravar,
//   compara o `statement` normalizado de cada linha contra todas as
//   questões já existentes no banco e pula (reportando) qualquer linha cujo
//   enunciado já exista.
//
// QUESTÕES COM IMAGEM
//   O CSV não tem coluna de imagem. Linhas cujo enunciado contém "imagem"
//   ou "figura" são sinalizadas no relatório final — a imagem precisa ser
//   anexada depois, manualmente ou via scripts/import-question-images.mjs
//   (mesmo id de questão gerado aqui).
//
// PRÉ-REQUISITOS: ver scripts/fix-question-area-id.mjs (mesmo padrão).
//
// USO
//   node scripts/import-questions-csv.mjs --csv ./caminho/arquivo.csv [--dry-run] [--key ./service-account.json]

import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';

function normalizeText(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Parser de CSV completo (não linha-a-linha) — obrigatório aqui porque
// `comments`/`statement` podem ter vírgulas e quebras de linha dentro de
// campos entre aspas (RFC 4180: "" escapa uma aspa literal).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') {
      // Linha em branco fora de aspas = fim do arquivo/separador espúrio, ignora.
      if (field === '' && row.length === 0) { i++; continue; }
      pushRow(); i++; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) pushRow();

  const header = rows[0];
  return rows.slice(1).filter(r => r.length > 1 || r[0] !== '').map(r => {
    const obj = {};
    header.forEach((col, idx) => { obj[col] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a.startsWith('--')) { out[a.slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

const { key, dryRun, csv } = parseArgs(process.argv.slice(2));

if (!csv) {
  console.error('Uso: node scripts/import-questions-csv.mjs --csv ./arquivo.csv [--dry-run] [--key ./service-account.json]');
  process.exit(1);
}

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();
initializeApp({ credential });

const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

async function run() {
  const csvText = readFileSync(csv, 'utf-8');
  const rows = parseCsv(csvText);
  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo ${csv} (${rows.length} linha(s) de dados)...\n`);

  const [areasSnap, themesSnap, groupsSnap, refsSnap, questionsSnap] = await Promise.all([
    db.collection('areas').get(),
    db.collection('themes').get(),
    db.collection('groups').get(),
    db.collection('reference').get(),
    db.collection('questions').get()
  ]);

  const areaByNormName = new Map(areasSnap.docs.map(d => [normalizeText(d.data().name), { id: d.id, ...d.data() }]));
  const groupByNormName = new Map(groupsSnap.docs.map(d => [normalizeText(d.data().name), { id: d.id, ...d.data() }]));
  const refByNormName = new Map(refsSnap.docs.map(d => [normalizeText(d.data().referenceName), { id: d.id, ...d.data() }]));
  // tema: chave composta areaId::normName, pra não casar tema de outra área por engano.
  const themeByAreaAndName = new Map(themesSnap.docs.map(d => [`${d.data().areaId}::${normalizeText(d.data().name)}`, { id: d.id, ...d.data() }]));
  const existingStatements = new Set(questionsSnap.docs.map(d => normalizeText(d.data().statement)));

  let batch = db.batch();
  let opCount = 0;
  const commitIfNeeded = async () => {
    if (opCount >= 350) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  let created = 0;
  let skippedDuplicate = 0;
  let newThemesCreated = 0;
  const unresolvedArea = [];
  const unresolvedGroup = [];
  const unresolvedReference = [];
  const needsImage = [];
  const newQuestionIds = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowLabel = `linha ${idx + 2}`; // +2 = 1 (header) + 1 (1-indexed)

    const normStatement = normalizeText(row.statement);
    if (existingStatements.has(normStatement)) {
      skippedDuplicate++;
      console.log(`  ⏭ ${rowLabel}: já existe uma questão com este enunciado — pulada.`);
      continue;
    }

    const area = areaByNormName.get(normalizeText(row.areaName));
    if (!area) {
      unresolvedArea.push({ row: rowLabel, areaName: row.areaName });
      console.log(`  ✗ ${rowLabel}: área "${row.areaName}" não encontrada — pulada.`);
      continue;
    }

    const group = groupByNormName.get(normalizeText(row.groupName));
    if (!group) {
      unresolvedGroup.push({ row: rowLabel, groupName: row.groupName });
      console.log(`  ✗ ${rowLabel}: grupo "${row.groupName}" não encontrado — pulada.`);
      continue;
    }

    const themeKey = `${area.id}::${normalizeText(row.themeName)}`;
    let theme = themeByAreaAndName.get(themeKey);
    if (!theme) {
      const themeNorm = normalizeText(row.themeName);
      const themeId = `theme_${themeNorm.replace(/[^a-z0-9]/g, '_')}`;
      theme = { id: themeId, name: row.themeName, areaId: area.id, areaName: area.name, groupId: group.id, groupName: group.name };
      themeByAreaAndName.set(themeKey, theme);
      newThemesCreated++;
      console.log(`  + ${rowLabel}: tema "${row.themeName}" não existia na área "${area.name}" — criando theme/${themeId}.`);
      if (!dryRun) {
        batch.set(db.collection('themes').doc(themeId), {
          id: themeId,
          areaId: area.id,
          areaName: area.name,
          name: row.themeName,
          normalizedName: themeNorm,
          groupId: group.id,
          groupName: group.name,
          questionCount: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
        opCount++;
        await commitIfNeeded();
      }
    }

    let referenceId;
    if (row.referenceName) {
      const ref = refByNormName.get(normalizeText(row.referenceName));
      if (ref) {
        referenceId = ref.id;
      } else {
        unresolvedReference.push({ row: rowLabel, referenceName: row.referenceName });
        console.log(`  ⚠ ${rowLabel}: referência "${row.referenceName}" sem correspondência em 'reference' — questão criada sem referenceId.`);
      }
    }

    const correctAlternative = (row.correctAlternative || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correctAlternative)) {
      console.log(`  ✗ ${rowLabel}: correctAlternative inválido ("${row.correctAlternative}") — pulada.`);
      continue;
    }

    const year = parseInt(row.sourceExamYear, 10);
    const sourceExam = `${row.sourceExam} ${row.sourceExamYear}`.trim();
    const qId = crypto.randomUUID();
    newQuestionIds.push(qId);

    if (/imagem|figura/i.test(row.statement)) {
      needsImage.push({ qId, statement: row.statement.slice(0, 90) });
    }

    console.log(`  ✓ ${rowLabel}: questions/${qId} — "${row.statement.slice(0, 60)}..." [${area.name} / ${theme.name} / ${group.name}]`);

    if (!dryRun) {
      const questionPayload = {
        id: qId,
        areaId: area.id,
        areaName: area.name,
        themeId: theme.id,
        themeName: theme.name,
        groupId: group.id,
        groupName: group.name,
        sourceExam,
        sourceExamName: row.sourceExam,
        sourceExamYear: Number.isFinite(year) ? year : null,
        statement: row.statement,
        alternatives: { A: row.A, B: row.B, C: row.C, D: row.D },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      batch.set(db.collection('questions').doc(qId), questionPayload);
      opCount++;
      await commitIfNeeded();

      const answerPayload = {
        questionId: qId,
        correctAlternative,
        comments: row.comments || '',
        updatedAt: new Date()
      };
      if (referenceId) answerPayload.referenceId = referenceId;
      batch.set(db.collection('questionAnswers').doc(qId), answerPayload);
      opCount++;
      await commitIfNeeded();
    }

    existingStatements.add(normStatement); // evita duplicar dentro do próprio CSV, se houver
    created++;
  }

  if (!dryRun && opCount > 0) {
    await batch.commit();
  }

  console.log('\nResumo:');
  console.log(`  linhas no CSV: ${rows.length}`);
  console.log(`  questões ${dryRun ? 'que seriam criadas' : 'criadas'}: ${created}`);
  console.log(`  puladas por já existir (enunciado duplicado): ${skippedDuplicate}`);
  console.log(`  temas novos ${dryRun ? 'que seriam criados' : 'criados'}: ${newThemesCreated}`);
  console.log(`  questões sinalizadas como precisando de imagem: ${needsImage.length}`);
  if (needsImage.length > 0) {
    needsImage.forEach(q => console.log(`    🖼 ${q.qId}: "${q.statement}..."`));
  }
  if (unresolvedArea.length > 0) {
    console.log(`\n  ✗ ${unresolvedArea.length} linha(s) com área não encontrada:`);
    unresolvedArea.forEach(u => console.log(`    ${u.row}: "${u.areaName}"`));
  }
  if (unresolvedGroup.length > 0) {
    console.log(`\n  ✗ ${unresolvedGroup.length} linha(s) com grupo não encontrado:`);
    unresolvedGroup.forEach(u => console.log(`    ${u.row}: "${u.groupName}"`));
  }
  if (unresolvedReference.length > 0) {
    console.log(`\n  ⚠ ${unresolvedReference.length} linha(s) com referência sem correspondência (questão criada sem link):`);
    unresolvedReference.forEach(u => console.log(`    ${u.row}: "${u.referenceName}"`));
  }
  if (dryRun) {
    console.log('\n  nada foi gravado (--dry-run). Rode sem --dry-run para aplicar.');
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
