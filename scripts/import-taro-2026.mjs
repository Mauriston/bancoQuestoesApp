#!/usr/bin/env node
// ==========================================
// scripts/import-taro-2026.mjs
// ==========================================
//
// Importa as 100 questões do TARO 2026 a partir de um CSV extraído da
// planilha do Google Sheets com as colunas:
//   sourceExamName, sourceExamYear, Questão, areaName, groupName, themeName,
//   statement, A, B, C, D, correctAlternative, referenceName, comments,
//   imageDriveUrl
//
// Mesmo padrão de scripts/import-questions-csv.mjs (id novo em UUID v4,
// proteção contra duplicidade pelo statement normalizado, tema criado se
// não existir), com duas diferenças específicas deste lote:
//
//   - areaName do CSV usa nomes "Cirurgia do/da X", que não batem
//     literalmente com o nome das áreas já cadastradas (ex.: "Cirurgia do
//     Joelho" -> "Joelho"). ÁREA_ALIASES mapeia isso explicitamente.
//   - referenceName do CSV é a citação ABNT + ", Cap. N"/", Seção N" no
//     final (ex.: "..., 2025., Cap. 23"). Esse sufixo de capítulo é
//     removido antes de casar com `reference.referenceName`; quando não há
//     correspondência (edição/volume novo), cria-se uma nova referência.
//
// A coluna imageDriveUrl é ignorada por este script — as imagens são
// importadas depois, manualmente pelo app.
//
// USO
//   node scripts/import-taro-2026.mjs --csv ./caminho/arquivo.csv [--dry-run] [--key ./service-account.json]

import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';

// CSV areaName -> nome já cadastrado em `areas` (inclui o typo existente
// "Metologia Científica").
const AREA_ALIASES = {
  'cirurgia da coluna': 'Coluna',
  'cirurgia da mao': 'Mão',
  'cirurgia do joelho': 'Joelho',
  'cirurgia do ombro e cotovelo': 'Ombro e Cotovelo',
  'cirurgia do pe e tornozelo': 'Pé e Tornozelo',
  'cirurgia do quadril': 'Quadril',
  'metodologia cientifica': 'Metologia Científica',
};

function normalizeText(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Remove o sufixo de capítulo/seção da citação (", Cap. 23", ", Cap.65",
// ", Seção 2" etc.) para casar com a citação-base já cadastrada.
function stripChapterSuffix(referenceName) {
  return referenceName.replace(/,\s*(Cap\.?|Se[cç][aã]o)\s*[\d.]+\s*$/i, '').trim();
}

function slugify(str) {
  return normalizeText(str).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

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
  console.error('Uso: node scripts/import-taro-2026.mjs --csv ./arquivo.csv [--dry-run] [--key ./service-account.json]');
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
  const themeByAreaAndName = new Map(themesSnap.docs.map(d => [`${d.data().areaId}::${normalizeText(d.data().name)}`, { id: d.id, ...d.data() }]));
  const existingStatements = new Set(questionsSnap.docs.map(d => normalizeText(d.data().statement)));
  const newReferenceIdsSeen = new Set();

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
  let newReferencesCreated = 0;
  const unresolvedArea = [];
  const unresolvedGroup = [];
  const needsImage = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowLabel = `linha ${idx + 2} (Questão ${row['Questão']})`;

    const normStatement = normalizeText(row.statement);
    if (existingStatements.has(normStatement)) {
      skippedDuplicate++;
      console.log(`  ⏭ ${rowLabel}: já existe uma questão com este enunciado — pulada.`);
      continue;
    }

    const normAreaName = normalizeText(row.areaName);
    const resolvedAreaName = AREA_ALIASES[normAreaName] || row.areaName;
    const area = areaByNormName.get(normalizeText(resolvedAreaName));
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
      const baseCitation = stripChapterSuffix(row.referenceName);
      const normBase = normalizeText(baseCitation);
      let ref = refByNormName.get(normBase);
      if (!ref) {
        const refId = `ref_${slugify(baseCitation).slice(0, 40)}_${crypto.createHash('md5').update(normBase).digest('hex').slice(0, 6)}`;
        ref = { id: refId, referenceName: baseCitation };
        refByNormName.set(normBase, ref);
        if (!newReferenceIdsSeen.has(refId)) {
          newReferenceIdsSeen.add(refId);
          newReferencesCreated++;
          console.log(`  + ${rowLabel}: referência "${baseCitation.slice(0, 70)}..." não existia — criando reference/${refId}.`);
          if (!dryRun) {
            batch.set(db.collection('reference').doc(refId), {
              id: refId,
              referenceId: refId,
              referenceName: baseCitation,
              referenceUrlDownload: '',
              active: true,
              updatedAt: new Date()
            }, { merge: true });
            opCount++;
            await commitIfNeeded();
          }
        }
      }
      referenceId = ref.id;
    }

    const correctAlternative = (row.correctAlternative || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correctAlternative)) {
      console.log(`  ✗ ${rowLabel}: correctAlternative inválido ("${row.correctAlternative}") — pulada.`);
      continue;
    }

    const year = parseInt(row.sourceExamYear, 10);
    const sourceExamName = (row.sourceExamName || '').trim();
    const sourceExam = `${sourceExamName} ${row.sourceExamYear}`.trim();
    const qId = crypto.randomUUID();

    if (row.imageDriveUrl && row.imageDriveUrl.trim()) {
      needsImage.push({ qId, questao: row['Questão'], imageDriveUrl: row.imageDriveUrl.trim() });
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
        sourceExamName,
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

    existingStatements.add(normStatement);
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
  console.log(`  referências novas ${dryRun ? 'que seriam criadas' : 'criadas'}: ${newReferencesCreated}`);
  console.log(`  questões com imagem pendente (imageDriveUrl não processado): ${needsImage.length}`);
  if (needsImage.length > 0) {
    needsImage.forEach(q => console.log(`    🖼 Questão ${q.questao} -> questions/${q.qId} : ${q.imageDriveUrl}`));
  }
  if (unresolvedArea.length > 0) {
    console.log(`\n  ✗ ${unresolvedArea.length} linha(s) com área não encontrada:`);
    unresolvedArea.forEach(u => console.log(`    ${u.row}: "${u.areaName}"`));
  }
  if (unresolvedGroup.length > 0) {
    console.log(`\n  ✗ ${unresolvedGroup.length} linha(s) com grupo não encontrado:`);
    unresolvedGroup.forEach(u => console.log(`    ${u.row}: "${u.groupName}"`));
  }
  if (dryRun) {
    console.log('\n  nada foi gravado (--dry-run). Rode sem --dry-run para aplicar.');
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
