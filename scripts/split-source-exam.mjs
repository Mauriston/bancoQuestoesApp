#!/usr/bin/env node
// ==========================================
// scripts/split-source-exam.mjs
// ==========================================
//
// Adiciona dois campos derivados de `sourceExam` em `questions/{id}`, para
// facilitar estatísticas por prova de origem sem precisar fazer parsing de
// string toda vez:
//   - sourceExamName: prefixo textual (ex.: "TEOT", "TARO", "BANCO PRÓPRIO",
//     ou qualquer outro valor legado como "SBOT")
//   - sourceExamYear: ano de 4 dígitos extraído do final da string (number),
//     ou `null` quando não há ano (ex.: "BANCO PRÓPRIO")
//
// `sourceExam` em si NÃO é alterado nem removido — continua exatamente como
// está hoje ("TEOT 2023", "BANCO PRÓPRIO", etc.), porque é isso que todo o
// resto do app (filtros, chip de cor, CSV) usa. Os dois campos novos são só
// aditivos, seguros de gravar sem afetar nenhuma tela existente.
//
// REGRA DE PARSING (genérica, não hardcoded pra "TEOT"/"TARO")
//   "<nome> <AAAA>" (ano de 4 dígitos no final) -> sourceExamName = "<nome>"
//   (trim), sourceExamYear = AAAA (number).
//   Sem 4 dígitos no final -> sourceExamName = sourceExam (trim),
//   sourceExamYear = null. Cobre "BANCO PRÓPRIO" e qualquer valor legado
//   sem ano (ex.: "SBOT").
//
// PRÉ-REQUISITOS: ver scripts/fix-question-area-id.mjs (mesmo padrão).
//
// USO
//   node scripts/split-source-exam.mjs [--dry-run] [--key ./service-account.json]
//
//   --dry-run mostra um resumo por valor distinto de sourceExam (quantas
//   questões, qual name/year seria atribuído) sem gravar nada.

import { readFileSync } from 'node:fs';
import { cert, applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-treinamentoteoti-380df538-23a0-4430-8321-7124c54a45e6';

function parseSourceExam(raw) {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/^(.*?)\s*(\d{4})$/);
  if (match) {
    return { name: match[1].trim(), year: parseInt(match[2], 10) };
  }
  return { name: trimmed, year: null };
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

const { key, dryRun } = parseArgs(process.argv.slice(2));

const credential = key ? cert(JSON.parse(readFileSync(key, 'utf-8'))) : applicationDefault();
initializeApp({ credential });

const db = getFirestore(undefined, FIRESTORE_DATABASE_ID);

async function run() {
  console.log(`${dryRun ? '[dry-run] ' : ''}Lendo 'questions'...\n`);

  const questionsSnap = await db.collection('questions').get();

  // Resumo por valor distinto de sourceExam, pra conferir de olho antes de
  // gravar em milhares de documentos.
  const summary = new Map(); // sourceExam -> { count, name, year }

  let batch = db.batch();
  let opCount = 0;
  const commitIfNeeded = async () => {
    if (opCount >= 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  let updatedCount = 0;
  let alreadyOkCount = 0;

  for (const qDoc of questionsSnap.docs) {
    const data = qDoc.data();
    const { name, year } = parseSourceExam(data.sourceExam);

    if (!summary.has(data.sourceExam)) {
      summary.set(data.sourceExam, { count: 0, name, year });
    }
    summary.get(data.sourceExam).count++;

    const alreadyOk = data.sourceExamName === name && (data.sourceExamYear ?? null) === year;
    if (alreadyOk) { alreadyOkCount++; continue; }

    updatedCount++;
    if (!dryRun) {
      batch.update(qDoc.ref, {
        sourceExamName: name,
        sourceExamYear: year,
        updatedAt: new Date()
      });
      opCount++;
      await commitIfNeeded();
    }
  }

  if (!dryRun && opCount > 0) {
    await batch.commit();
  }

  console.log('Valores distintos de sourceExam encontrados:');
  for (const [sourceExam, info] of [...summary.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  "${sourceExam}" (${info.count}x) -> sourceExamName="${info.name}", sourceExamYear=${info.year}`);
  }

  console.log('\nResumo:');
  console.log(`  total de questões: ${questionsSnap.size}`);
  console.log(`  já estavam com sourceExamName/sourceExamYear corretos: ${alreadyOkCount}`);
  console.log(`  ${dryRun ? 'seriam atualizadas' : 'atualizadas'}: ${updatedCount}`);
  if (dryRun) {
    console.log('\n  nada foi gravado (--dry-run). Rode sem --dry-run para aplicar.');
  }
}

run().catch((err) => {
  console.error('\nFalhou:', err);
  process.exit(1);
});
